# Deploy `web` to Vercel

1. Import the repository and set **Root Directory** to `web`.
2. Deploy Convex from this directory:

   ```powershell
   npx convex deploy
   npx convex env set INTERNAL_JOB_SECRET <long-random-secret>
   ```

3. Configure Vercel Production and Preview environments:

| Variable | Required |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Yes; use the matching Convex deployment URL |
| `INTERNAL_JOB_SECRET` | Yes; use the same value configured in Convex |
| `LLM_API_KEY` or `OPENAI_API_KEY` | Yes for extraction |
| `LLM_BASE_URL` and `LLM_MODEL` | Provider-specific |
| `SEMANTIC_SCHOLAR_API_KEY` | Recommended |
| `EXA_API_KEY` | Optional |

`INTERNAL_JOB_SECRET` must never use a `NEXT_PUBLIC_` prefix.

4. Keep the standard install and build commands: `npm install` and
   `npm run build`.
5. After deployment, run a small PDF scan and confirm that the Convex job
   reaches `complete`.

The check route allows up to 300 seconds, but the effective duration depends on
the Vercel plan. The local rate limiter is per server instance; use a shared
edge/store limiter for stronger multi-instance abuse protection.
