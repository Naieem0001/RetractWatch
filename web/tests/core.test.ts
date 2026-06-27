import assert from "node:assert/strict";
import test from "node:test";
import { calculateDownstreamRisk } from "../lib/downstreamRisk";
import { mapPool } from "../lib/asyncPool";
import { normalizeExtractedCitation } from "../lib/normalizeExtractedCitations";
import {
  calculateIntegrityScore,
  type Citation,
} from "../lib/scoring";
import { isRetracted } from "../lib/retractionWatch";
import { checkRateLimit } from "../lib/rateLimit";
import { assertWriteSecret } from "../convex/writeAuth";

function citation(status: Citation["status"]): Citation {
  return {
    id: status,
    title: status,
    authors: "Test",
    year: 2024,
    doi: null,
    status,
  };
}

test("inconclusive cascade checks are not scored as contamination", () => {
  const rows = [citation("clean"), citation("cascade-unknown")];
  assert.equal(calculateIntegrityScore(rows), 100);
  assert.equal(calculateDownstreamRisk(rows).flaggedInBibliography, 0);
});

test("confirmed cascade checks still reduce the score", () => {
  const rows = [citation("clean"), citation("cascade")];
  assert.equal(calculateIntegrityScore(rows), 88);
  assert.equal(calculateDownstreamRisk(rows).cascadeCount, 1);
});

test("LLM citation normalization bounds untrusted fields", () => {
  const normalized = normalizeExtractedCitation(
    {
      title: "t".repeat(3_000),
      authors: "a".repeat(2_000),
      year: "2020",
      doi: "d".repeat(700),
    },
    0,
  );
  assert.equal(normalized.title.length, 2_000);
  assert.equal(normalized.authors.length, 1_500);
  assert.equal(normalized.doi?.length, 512);
  assert.equal(normalized.year, 2020);
});

test("async pool preserves input order and respects its concurrency cap", async () => {
  let active = 0;
  let maxActive = 0;
  const result = await mapPool([3, 1, 2, 0], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, value * 2));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(result, [30, 10, 20, 0]);
  assert.ok(maxActive <= 2);
});

test("compressed Retraction Watch snapshot remains queryable", () => {
  const hit = isRetracted("https://doi.org/10.5772/64329");
  assert.ok(hit);
  assert.match(hit.retractionReason, /duplicat/i);
});

test("Convex writes fail closed without the configured shared secret", () => {
  const previous = process.env.INTERNAL_JOB_SECRET;
  try {
    delete process.env.INTERNAL_JOB_SECRET;
    assert.throws(() => assertWriteSecret("candidate"), /not configured/i);

    process.env.INTERNAL_JOB_SECRET = "correct-secret";
    assert.throws(() => assertWriteSecret("wrong-secret"), /unauthorized/i);
    assert.doesNotThrow(() => assertWriteSecret("correct-secret"));
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_JOB_SECRET;
    else process.env.INTERNAL_JOB_SECRET = previous;
  }
});

test("unidentified clients use the stricter rate-limit bucket", () => {
  const request = new Request("https://example.test/api/check");
  const key = `test-${Date.now()}-${Math.random()}`;
  for (let index = 0; index < 3; index += 1) {
    assert.deepEqual(
      checkRateLimit(request, { key, limit: 10, globalLimit: 100 }),
      { ok: true },
    );
  }
  assert.equal(
    checkRateLimit(request, { key, limit: 10, globalLimit: 100 }).ok,
    false,
  );
});
