import Link from "next/link";

export default function CompatibilityHome() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/70 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          RetractWatch workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Use the web application root</h1>
        <p className="mt-4 leading-7 text-slate-300">
          The maintained application lives in <code>web/</code>. Configure your
          local command or Vercel project to use that directory so the frontend,
          API routes, Convex functions, and dependency lockfile stay aligned.
        </p>
        <Link
          className="mt-6 inline-flex rounded-lg bg-blue-500 px-4 py-2 font-medium text-white"
          href="https://github.com/m0hammedbshaheer/Retract_Watch"
        >
          Repository
        </Link>
      </section>
    </main>
  );
}
