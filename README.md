# RetractWatch / Talos

RetractWatch checks a bibliography for direct retractions, confirmed citation
cascades, replacement papers, and an overall integrity score.

## Canonical application

Use `web/` as the application and Vercel project root. The repository root still
contains compatibility files inherited from older branches; they are not the
deployment target.

## Local setup

```powershell
cd web
npm install
Copy-Item .env.local.example .env.local
npm run convex
npm run dev
```

Set the same strong `INTERNAL_JOB_SECRET` in:

- `web/.env.local` for the Next.js server
- the linked Convex deployment (`npx convex env set INTERNAL_JOB_SECRET ...`)

The secret protects all public Convex write mutations. Never prefix it with
`NEXT_PUBLIC_`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL used by server and browser |
| `INTERNAL_JOB_SECRET` | Yes | Server-to-Convex write authorization |
| `LLM_API_KEY` or `OPENAI_API_KEY` | Yes | Bibliography extraction |
| `LLM_BASE_URL` | Provider-specific | OpenAI-compatible API base URL |
| `LLM_MODEL` | Provider-specific | Extraction model |
| `SEMANTIC_SCHOLAR_API_KEY` | Recommended | Higher cascade-check limits |
| `EXA_API_KEY` | Optional | Replacement suggestions |

`CONVEX_DEPLOYMENT` is typically managed by the Convex CLI for local/dev workflows and
is not required in Vercel runtime env. `NEXT_PUBLIC_CONVEX_SITE_URL` is also optional
unless you use Convex site features directly.

## Pipeline

1. Parse bibliography text from a PDF.
2. Extract structured citations with the configured LLM.
3. Resolve missing DOIs through Crossref.
4. Check the bundled Retraction Watch snapshot.
5. Check references through Semantic Scholar for confirmed cascades.
6. Find optional replacements through Exa.
7. Persist live progress and results in Convex.

An unavailable Semantic Scholar response is stored as `cascade-unknown`; it is
not counted as confirmed contamination or penalized in the integrity score.

## Limits and security

- PDF uploads: 10 MB maximum and validated by PDF signature.
- Analysis jobs: 200 citations and 1 MB JSON request maximum.
- `/api/check`: 10 requests per identified client per minute.
- `/api/extract`: 15 requests per identified client per minute.
- The in-process limiter is a basic per-instance guard. Add a shared edge/store
  limiter for multi-instance production traffic.
- The Retraction Watch snapshot is bundled as
  `web/data/retraction_watch.csv.gz`; results may lag newer retractions.
- Bibliography text (up to roughly 8,000 characters), not the full manuscript,
  is sent to the configured LLM provider.

## Verification

From `web/`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Deployment

1. Rotate every credential that appeared in historical commit `747d616`.
2. Set Render Root Directory to `web`.
3. Deploy Convex from `web/`, with `INTERNAL_JOB_SECRET` configured.
4. Add the matching variables to Render.
5. Build and run a small end-to-end scan before larger bibliographies.

`/api/check` requests up to 300 seconds. Hosting-plan limits may be lower, so
large jobs should eventually move to a durable background worker.
