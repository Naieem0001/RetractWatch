import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertWriteSecret } from "./writeAuth";

export const createReplacement = mutation({
  args: {
    writeSecret: v.string(),
    citationId: v.id("citations"),
    title: v.string(),
    url: v.string(),
    summary: v.string(),
    publishedDate: v.string(),
    relevanceScore: v.number(),
  },
  handler: async (ctx, { writeSecret, ...replacement }) => {
    assertWriteSecret(writeSecret);
    const existing = await ctx.db
      .query("replacements")
      .withIndex("by_citation_and_url", (q) =>
        q.eq("citationId", replacement.citationId).eq("url", replacement.url),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("replacements", replacement);
  },
});

export const getReplacementsForCitation = query({
  args: { citationId: v.id("citations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("replacements")
      .withIndex("by_citation", (q) => q.eq("citationId", args.citationId))
      .take(10);
  },
});

export const getReplacementsForCitations = query({
  args: { citationIds: v.array(v.id("citations")) },
  handler: async (ctx, args) => {
    if (args.citationIds.length > 200) {
      throw new Error("At most 200 citation ids are allowed");
    }
    const results = [];
    for (const cid of args.citationIds) {
      const reps = await ctx.db
        .query("replacements")
        .withIndex("by_citation", (q) => q.eq("citationId", cid))
        .take(10);
      results.push(...reps);
    }
    return results;
  },
});
