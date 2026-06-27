/** True when Convex client is configured (browser bundle). */
export function hasConvexUrl(): boolean {
  if (typeof process === "undefined") return false;
  const u = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!u) return false;
  if (u.toLowerCase().includes("your-deployment")) return false;
  return true;
}
