import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertWriteSecret } from "./writeAuth";

/** api.jobs.getJob */
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

/** Atomically creates a job and all of its citation rows. */
export const createJobWithCitations = mutation({
  args: {
    writeSecret: v.string(),
    status: v.string(),
    paperTitle: v.optional(v.string()),
    createdAt: v.number(),
    citations: v.array(
      v.object({
        title: v.string(),
        authors: v.string(),
        year: v.optional(v.number()),
        doi: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { writeSecret, citations, ...job }) => {
    assertWriteSecret(writeSecret);
    if (citations.length === 0 || citations.length > 200) {
      throw new Error("A job must contain between 1 and 200 citations");
    }

    const jobId = await ctx.db.insert("jobs", {
      ...job,
      totalCitations: citations.length,
      processedCount: 0,
    });
    const citationIds = [];
    for (const citation of citations) {
      citationIds.push(
        await ctx.db.insert("citations", {
          ...citation,
          jobId,
          status: "pending",
        }),
      );
    }
    return { jobId, citationIds };
  },
});

/** api.jobs.updateJob */
export const updateJob = mutation({
  args: {
    writeSecret: v.string(),
    jobId: v.id("jobs"),
    status: v.optional(v.string()),
    totalCitations: v.optional(v.number()),
    processedCount: v.optional(v.number()),
    integrityScore: v.optional(v.number()),
    paperTitle: v.optional(v.string()),
    historicalComparison: v.optional(v.any()),
    downstreamRisk: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, { writeSecret, jobId, ...rest }) => {
    assertWriteSecret(writeSecret);
    const existing = await ctx.db.get(jobId);
    if (!existing) throw new Error("Job not found");

    const patch: Record<string, unknown> = {};
    if (rest.status !== undefined && rest.status !== existing.status) {
      patch.status = rest.status;
    }
    if (
      rest.totalCitations !== undefined &&
      rest.totalCitations !== existing.totalCitations
    ) {
      patch.totalCitations = rest.totalCitations;
    }
    if (
      rest.processedCount !== undefined &&
      rest.processedCount !== existing.processedCount
    ) {
      patch.processedCount = rest.processedCount;
    }
    if (
      rest.integrityScore !== undefined &&
      rest.integrityScore !== existing.integrityScore
    ) {
      patch.integrityScore = rest.integrityScore;
    }
    if (rest.paperTitle !== undefined && rest.paperTitle !== existing.paperTitle) {
      patch.paperTitle = rest.paperTitle;
    }
    if (
      rest.historicalComparison !== undefined &&
      JSON.stringify(rest.historicalComparison) !==
        JSON.stringify(existing.historicalComparison)
    ) {
      patch.historicalComparison = rest.historicalComparison;
    }
    if (
      rest.downstreamRisk !== undefined &&
      JSON.stringify(rest.downstreamRisk) !== JSON.stringify(existing.downstreamRisk)
    ) {
      patch.downstreamRisk = rest.downstreamRisk;
    }
    if (rest.createdAt !== undefined && rest.createdAt !== existing.createdAt) {
      patch.createdAt = rest.createdAt;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(jobId, patch);
    }
  },
});
