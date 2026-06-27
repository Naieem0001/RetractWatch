// DOCUMENTATION NOTE:
// Creates Convex job + citations, returns immediately, runs pipeline in background.

import { ConvexHttpClient } from "convex/browser";
import { after, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  runPipeline,
  type PipelineCitation,
  type RetractionRecord,
} from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_CITATIONS = 200;
const MAX_JSON_CHARS = 1_000_000;
const MAX_TITLE_CHARS = 2_000;
const MAX_AUTHORS_CHARS = 1_500;
const MAX_DOI_CHARS = 512;

function errorDetail(e: unknown): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  if (e instanceof Error) return e.message;
  return String(e);
}

function coerceYear(y: unknown): number | undefined {
  if (y == null) return undefined;
  const n = typeof y === "number" ? y : Number(y);
  const maxYear = new Date().getUTCFullYear() + 1;
  return Number.isInteger(n) && n >= 1000 && n <= maxYear ? n : undefined;
}

type IncomingRow = {
  title: string;
  authors: string;
  year?: number;
  doi?: string;
};

function normalizeBodyCitations(raw: unknown): IncomingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const o =
      item != null && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};
    const title =
      typeof o.title === "string" && o.title.trim()
        ? o.title.trim().slice(0, MAX_TITLE_CHARS)
        : `Untitled reference ${i + 1}`;
    const authors =
      typeof o.authors === "string" && o.authors.trim()
        ? o.authors.trim().slice(0, MAX_AUTHORS_CHARS)
        : "Unknown";
    return {
      title,
      authors,
      year: coerceYear(o.year),
      doi:
        typeof o.doi === "string" && o.doi.trim()
          ? o.doi.trim().slice(0, MAX_DOI_CHARS)
          : undefined,
    };
  });
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    key: "check",
    limit: 10,
    globalLimit: 60,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl || convexUrl.toLowerCase().includes("your-deployment")) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_CONVEX_URL is missing or still set to the placeholder. Copy your real Convex URL from the Convex dashboard into web/.env.local and restart `npm run dev`.",
      },
      { status: 503 },
    );
  }

  const writeSecret = process.env.INTERNAL_JOB_SECRET?.trim();
  if (!writeSecret) {
    return NextResponse.json(
      {
        error:
          "INTERNAL_JOB_SECRET is not configured for the Next.js and Convex deployments.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_CHARS) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    const rawBody = await request.text();
    if (rawBody.length > MAX_JSON_CHARS) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const citationsRaw =
    body && typeof body === "object" && body !== null && "citations" in body
      ? (body as { citations: unknown }).citations
      : undefined;

  if (!Array.isArray(citationsRaw) || citationsRaw.length === 0) {
    return NextResponse.json(
      { error: "Expected JSON body: { citations: [...] } with at least one row" },
      { status: 400 },
    );
  }
  if (citationsRaw.length > MAX_CITATIONS) {
    return NextResponse.json(
      { error: `At most ${MAX_CITATIONS} citations can be analyzed per job` },
      { status: 400 },
    );
  }

  const rows = normalizeBodyCitations(citationsRaw);
  const paperTitle =
    body && typeof body === "object" && body !== null && "paperTitle" in body
      ? String((body as { paperTitle?: unknown }).paperTitle ?? "")
          .trim()
          .slice(0, 500) || undefined
      : undefined;

  const client = new ConvexHttpClient(convexUrl);

  // Each POST creates a new Convex job id — there is no reuse/cache by PDF content.
  let convexJobId: Id<"jobs">;
  let citationIds: Id<"citations">[];
  try {
    const created = await client.mutation(api.jobs.createJobWithCitations, {
      writeSecret,
      status: "running",
      createdAt: Date.now(),
      paperTitle,
      citations: rows,
    });
    convexJobId = created.jobId;
    citationIds = created.citationIds;
  } catch (e) {
    console.error("[check] createJob failed", e);
    return NextResponse.json(
      {
        error: "Failed to create analysis job. Deploy Convex functions (`npx convex deploy` or run `npm run convex`) and ensure NEXT_PUBLIC_CONVEX_URL matches that deployment.",
        detail: errorDetail(e),
      },
      { status: 500 },
    );
  }

  const pipelineCitations: PipelineCitation[] = rows.map((row, index) => ({
    id: String(citationIds[index]),
    title: row.title,
    authors: row.authors,
    year: row.year,
    doi: row.doi,
    status: "pending",
  }));

  const jobIdStr = String(convexJobId);

  after(() =>
    runPipeline(jobIdStr, pipelineCitations, {
    updateCitation: async (citationId, updates) => {
      const u = updates as Record<string, unknown>;
      try {
        const patch: {
          writeSecret: string;
          citationId: Id<"citations">;
          title?: string;
          authors?: string;
          year?: number;
          doi?: string;
          status?: string;
          retractionReason?: string;
          retractionDate?: string;
          retractionCountry?: string;
          retractionJournal?: string;
          cascadeVia?: string;
        } = {
          writeSecret,
          citationId: citationId as Id<"citations">,
        };

        if (typeof u.status === "string") patch.status = u.status;
        if (typeof u.doi === "string") patch.doi = u.doi;
        if (typeof u.title === "string") patch.title = u.title;
        if (typeof u.authors === "string") patch.authors = u.authors;
        if (typeof u.cascadeVia === "string") patch.cascadeVia = u.cascadeVia;

        const ret = u.retraction;
        if (ret && typeof ret === "object") {
          const r = ret as RetractionRecord;
          patch.retractionReason = r.retractionReason;
          patch.retractionDate = r.retractionDate;
          patch.retractionCountry = r.retractionCountry;
          patch.retractionJournal = r.retractionJournal;
        }

        await client.mutation(api.citations.updateCitation, patch);
      } catch (err) {
        console.error("[check] updateCitation", citationId, err);
      }
    },
    updateJob: async (payload) => {
      const u = payload as Record<string, unknown>;
      try {
        const patch: {
          writeSecret: string;
          jobId: Id<"jobs">;
          status?: string;
          totalCitations?: number;
          processedCount?: number;
          integrityScore?: number;
          paperTitle?: string;
          downstreamRisk?: unknown;
        } = { writeSecret, jobId: convexJobId };

        if (typeof u.status === "string") patch.status = u.status;
        if (typeof u.totalCitations === "number") {
          patch.totalCitations = u.totalCitations;
        }
        if (typeof u.processedCount === "number") {
          patch.processedCount = u.processedCount;
        }
        if (typeof u.integrityScore === "number") {
          patch.integrityScore = u.integrityScore;
        }
        if (typeof u.paperTitle === "string") patch.paperTitle = u.paperTitle;
        if (u.downstreamRisk !== undefined) {
          patch.downstreamRisk = u.downstreamRisk;
        }

        await client.mutation(api.jobs.updateJob, patch);
      } catch (err) {
        console.error("[check] updateJob", err);
      }
    },
    }).catch((err) => {
      console.error("[check] pipeline", jobIdStr, err);
    }),
  );

  return NextResponse.json({ jobId: jobIdStr });
}
