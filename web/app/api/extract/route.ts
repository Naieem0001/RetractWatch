// DOCUMENTATION NOTE:
// Extracts structured citations from an uploaded PDF via an OpenAI-compatible Chat API.

import { loadLlmExtractConfig } from "@/lib/llmExtractConfig";
import { normalizeExtractedCitations } from "@/lib/normalizeExtractedCitations";
import { checkRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import OpenAI, { APIError } from "openai";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
/** Long PDF + LLM calls on serverless (optional; ignored locally). */
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_TEXT_LEN = 100;
const BIB_FALLBACK_CHARS = 6000;
const BIB_MAX_CHARS = 8000;
const MAX_CITATIONS = 200;

const BIB_REGEX =
  /(?:references|bibliography|works cited|literature cited)\s*\n([\s\S]+?)(?:\n\s*appendix|\n\s*supplementary|$)/i;

const SYSTEM_PROMPT =
  "You are a scientific bibliography parser. Extract all references from the provided bibliography text. Return ONLY a valid JSON object with a 'citations' array. Each citation must have: { title: string, authors: string, year: number | null, doi: string | null }. If DOI not present, set to null. Return nothing except the JSON object.";

function stripMarkdownFences(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "");
  s = s.replace(/\s*```\s*$/i, "");
  return s.trim();
}

function jsonErrorBody(
  error: string,
  status: number,
  detail?: string,
): NextResponse {
  const body: { error: string; detail?: string } = { error };
  if (process.env.NODE_ENV === "development" && detail) {
    body.detail = detail;
  }
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    key: "extract",
    limit: 15,
    globalLimit: 45,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many extraction requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_BYTES + 256 * 1024
    ) {
      return NextResponse.json(
        { error: "Upload body is too large. Please upload a PDF under 10MB." },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file received" },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "PDF too large. Please upload under 10MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json(
        { error: "The uploaded file is not a valid PDF." },
        { status: 400 },
      );
    }

    const llm = loadLlmExtractConfig();
    if (!llm.ok) {
      return jsonErrorBody(llm.error, 503);
    }
    const {
      apiKey,
      baseURL,
      model,
      jsonMode,
      maxCompletionTokens,
      reasoningEffort,
    } = llm.config;

    let text: string;
    try {
      const pdfData = await pdfParse(buffer);
      text = (pdfData.text ?? "").trim();
    } catch (pdfErr) {
      console.error("[extract] pdf-parse failed", pdfErr);
      return jsonErrorBody(
        "Could not read this PDF. Try another file or a text-based (not scanned) PDF.",
        400,
        pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
      );
    }

    if (text.length < MIN_TEXT_LEN) {
      return NextResponse.json(
        {
          error:
            "This PDF appears to be a scanned image. Please use a text-based PDF.",
        },
        { status: 400 },
      );
    }

    const match = text.match(BIB_REGEX);
    let bibliographyText = match?.[1]?.trim() ?? "";
    if (!bibliographyText) {
      bibliographyText = text.slice(-BIB_FALLBACK_CHARS);
    }
    bibliographyText = bibliographyText.slice(0, BIB_MAX_CHARS);

    const openai = new OpenAI({ apiKey, baseURL });
    const host = (baseURL ?? "").toLowerCase();
    const reasoningSafe =
      reasoningEffort &&
      (!host || host.includes("openai.com") || host.includes("api.openai.com"));
    let rawContent: string | null;
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0,
        max_completion_tokens: maxCompletionTokens,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        ...(reasoningSafe ? { reasoning_effort: reasoningEffort } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all references from this bibliography:\n\n${bibliographyText}`,
          },
        ],
      });
      rawContent = completion.choices[0]?.message?.content ?? null;
    } catch (openaiErr) {
      console.error("[extract] LLM request failed", openaiErr);
      if (openaiErr instanceof APIError) {
        if (openaiErr.status === 429) {
          return jsonErrorBody(
            "Your LLM provider rate-limited PDF extraction or the account is out of quota. Wait a moment and try again, or check the provider billing and rate limits for the configured model.",
            429,
            openaiErr.message,
          );
        }
        return jsonErrorBody(
          openaiErr.message ||
            "The LLM API returned an error. Check your key, model name, and provider dashboard.",
          openaiErr.status && openaiErr.status >= 400 && openaiErr.status < 600
            ? openaiErr.status
            : 502,
          openaiErr.message,
        );
      }
      return jsonErrorBody(
        "The citation extraction service failed. Try again in a moment.",
        502,
        openaiErr instanceof Error ? openaiErr.message : String(openaiErr),
      );
    }

    if (!rawContent) {
      return jsonErrorBody("Empty response from the model.", 502);
    }

    let parsed: { citations?: unknown };
    try {
      const jsonStr = stripMarkdownFences(rawContent);
      parsed = JSON.parse(jsonStr) as { citations?: unknown };
    } catch (parseErr) {
      console.error("[extract] JSON parse failed", parseErr, rawContent.slice(0, 500));
      return jsonErrorBody(
        "The model returned invalid JSON. Try again or use a smaller PDF.",
        502,
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      );
    }

    const rawList = Array.isArray(parsed.citations) ? parsed.citations : [];
    const citations = normalizeExtractedCitations(
      rawList.slice(0, MAX_CITATIONS),
    );

    return NextResponse.json({
      citations,
      totalFound: citations.length,
    });
  } catch (e) {
    console.error("[extract] unexpected", e);
    return jsonErrorBody(
      "An unexpected error occurred while processing the PDF.",
      500,
      e instanceof Error ? e.message : String(e),
    );
  }
}
