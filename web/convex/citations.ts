import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertWriteSecret } from "./writeAuth";

/** api.citations.getCitationsForJob */
export const getCitationsForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("citations")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .take(200);
  },
});

/** api.citations.updateCitation */
export const updateCitation = mutation({
  args: {
    writeSecret: v.string(),
    citationId: v.id("citations"),
    title: v.optional(v.string()),
    authors: v.optional(v.string()),
    year: v.optional(v.number()),
    doi: v.optional(v.string()),
    status: v.optional(v.string()),
    retractionReason: v.optional(v.string()),
    retractionDate: v.optional(v.string()),
    retractionCountry: v.optional(v.string()),
    retractionJournal: v.optional(v.string()),
    cascadeDepth: v.optional(v.number()),
    cascadeVia: v.optional(v.string()),
  },
  handler: async (ctx, { writeSecret, citationId, ...rest }) => {
    assertWriteSecret(writeSecret);
    const existing = await ctx.db.get(citationId);
    if (!existing) throw new Error("Citation not found");

    const patch: Record<string, unknown> = {};
    if (rest.title !== undefined && rest.title !== existing.title) {
      patch.title = rest.title;
    }
    if (rest.authors !== undefined && rest.authors !== existing.authors) {
      patch.authors = rest.authors;
    }
    if (rest.year !== undefined && rest.year !== existing.year) patch.year = rest.year;
    if (rest.doi !== undefined && rest.doi !== existing.doi) patch.doi = rest.doi;
    if (rest.status !== undefined && rest.status !== existing.status) {
      patch.status = rest.status;
    }
    if (
      rest.retractionReason !== undefined &&
      rest.retractionReason !== existing.retractionReason
    ) {
      patch.retractionReason = rest.retractionReason;
    }
    if (
      rest.retractionDate !== undefined &&
      rest.retractionDate !== existing.retractionDate
    ) {
      patch.retractionDate = rest.retractionDate;
    }
    if (
      rest.retractionCountry !== undefined &&
      rest.retractionCountry !== existing.retractionCountry
    ) {
      patch.retractionCountry = rest.retractionCountry;
    }
    if (
      rest.retractionJournal !== undefined &&
      rest.retractionJournal !== existing.retractionJournal
    ) {
      patch.retractionJournal = rest.retractionJournal;
    }
    if (
      rest.cascadeDepth !== undefined &&
      rest.cascadeDepth !== existing.cascadeDepth
    ) {
      patch.cascadeDepth = rest.cascadeDepth;
    }
    if (rest.cascadeVia !== undefined && rest.cascadeVia !== existing.cascadeVia) {
      patch.cascadeVia = rest.cascadeVia;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(citationId, patch);
    }
  },
});
