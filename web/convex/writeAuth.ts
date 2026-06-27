const SECRET_ENV_NAME = "INTERNAL_JOB_SECRET";

/** Protect server-owned mutations from direct calls through the public Convex API. */
export function assertWriteSecret(candidate: string): void {
  const expected = process.env[SECRET_ENV_NAME]?.trim();
  if (!expected) {
    throw new Error(`${SECRET_ENV_NAME} is not configured in Convex`);
  }
  if (!candidate || candidate !== expected) {
    throw new Error("Unauthorized Convex write");
  }
}
