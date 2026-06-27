/**
 * Coerce LLM JSON into rows /api/check accepts (title, authors, year, doi).
 */

export type ExtractedCitationRow = {
  title: string;
  authors: string;
  year?: number;
  doi?: string;
};

function coerceYear(y: unknown): number | undefined {
  if (y == null || y === "") return undefined;
  if (typeof y === "number" && !Number.isNaN(y)) return y;
  const n = Number(String(y).trim());
  return Number.isNaN(n) ? undefined : n;
}

export function normalizeExtractedCitation(
  raw: unknown,
  index: number,
): ExtractedCitationRow {
  const o =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const titleRaw = o.title;
  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim().slice(0, 2000)
      : `Untitled reference ${index + 1}`;

  const authorsRaw = o.authors;
  const authors =
    typeof authorsRaw === "string" && authorsRaw.trim()
      ? authorsRaw.trim().slice(0, 1500)
      : "Unknown";

  const year = coerceYear(o.year);

  const doiRaw = o.doi;
  const doi =
    typeof doiRaw === "string" && doiRaw.trim()
      ? doiRaw.trim().slice(0, 512)
      : undefined;

  return { title, authors, year, doi };
}

export function normalizeExtractedCitations(raw: unknown[]): ExtractedCitationRow[] {
  return raw.map((item, i) => normalizeExtractedCitation(item, i));
}
