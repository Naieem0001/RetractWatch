type Bucket = { count: number; resetAt: number };

type RateLimitOptions = {
  key: string;
  limit: number;
  globalLimit: number;
  windowMs?: number;
};

type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

const buckets = new Map<string, Bucket>();

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    firstForwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    "unidentified"
  );
}

function consume(key: string, limit: number, now: number, windowMs: number) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { allowed: false, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, resetAt: current.resetAt };
}

/**
 * Per-instance abuse guard. Production deployments should additionally use a
 * shared rate-limit store at the edge or gateway.
 */
export function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): RateLimitResult {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.RATE_LIMIT_DISABLED === "1"
  ) {
    return { ok: true };
  }

  const now = Date.now();
  const windowMs = options.windowMs ?? 60_000;
  const address = clientAddress(request);
  const clientLimit = address === "unidentified" ? Math.min(3, options.limit) : options.limit;

  if (buckets.size > 10_000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const client = consume(
    `client:${options.key}:${address}`,
    clientLimit,
    now,
    windowMs,
  );
  if (!client.allowed) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((client.resetAt - now) / 1000),
      ),
    };
  }

  const global = consume(`global:${options.key}`, options.globalLimit, now, windowMs);
  if (global.allowed) return { ok: true };

  return {
    ok: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((global.resetAt - now) / 1000),
    ),
  };
}
