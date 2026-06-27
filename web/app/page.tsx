"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AnalysisLoadingOverlay } from "@/components/AnalysisLoadingOverlay";
import { hasConvexUrl } from "@/lib/convexEnv";

export default function HomePage() {
  const router = useRouter();
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [step, setStep] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStepTimer = () => {
    if (stepTimerRef.current !== null) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };

  const startIntegrityJob = useCallback(
    async (citations: unknown[], paperTitle?: string) => {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citations, paperTitle }),
      });
      const data = (await res.json()) as {
        jobId?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const hint =
          data.detail && process.env.NODE_ENV === "development"
            ? ` (${data.detail})`
            : "";
        throw new Error(
          `${data.error ?? "Failed to start integrity scan"}${hint}`,
        );
      }
      if (!data.jobId) {
        throw new Error("No job id returned");
      }
      return data.jobId;
    },
    [],
  );

  const runPdfFlow = useCallback(
    async (file: File) => {
      setError("");
      setLoading(true);
      setStep(0);
      setLoadMsg("Extracting references from your PDF…");

      if (!hasConvexUrl()) {
        setLoading(false);
        setError(
          "Add NEXT_PUBLIC_CONVEX_URL to .env.local (your hosted backend) to run a full scan.",
        );
        return;
      }

      try {
        clearStepTimer();
        const fd = new FormData();
        fd.append("pdf", file);
        const ex = await fetch("/api/extract", { method: "POST", body: fd });
        const exData = (await ex.json()) as {
          citations?: unknown[];
          error?: string;
          detail?: string;
        };
        if (!ex.ok) {
          const msg = exData.error ?? "PDF extraction failed";
          const hint =
            exData.detail && process.env.NODE_ENV === "development"
              ? ` (${exData.detail})`
              : "";
          throw new Error(`${msg}${hint}`);
        }
        const citations = exData.citations;
        if (!Array.isArray(citations) || citations.length === 0) {
          throw new Error("No citations found in this PDF.");
        }

        stepTimerRef.current = setInterval(() => {
          setStep((s) => Math.min(s + 1, 2));
        }, 18000);
        setStep(1);
        setLoadMsg("Cross-checking DOIs, retractions, and cascades…");
        const jobId = await startIntegrityJob(citations, file.name);
        clearStepTimer();
        setLoadMsg("Opening your results…");
        setStep(3);
        await new Promise((r) => setTimeout(r, 600));
        // Keep overlay open — do NOT call setLoading(false) before navigation
        // so the home page never flashes through.
        router.push(`/results/${jobId}`);
        // Overlay stays mounted until Next.js unmounts this page.
      } catch (e) {
        clearStepTimer();
        setLoading(false);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    },
    [router, startIntegrityJob],
  );

  const runPasteFlow = useCallback(async () => {
    setError("");
    const lines = paste.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      setError("Paste at least one reference line, or upload a PDF.");
      return;
    }

    if (!hasConvexUrl()) {
      setError(
        "Add NEXT_PUBLIC_CONVEX_URL to .env.local (your hosted backend) to run a full scan.",
      );
      return;
    }

    setLoading(true);
    setStep(0);
    setLoadMsg("Preparing references…");

    try {
      const citations = lines.map((line) => ({
        title: line.slice(0, 800),
        authors: "Unknown",
        year: null,
        doi: null,
      }));

      setStep(1);
      setLoadMsg("Cross-checking DOIs, retractions, and cascades…");
      const jobId = await startIntegrityJob(citations);
      setLoadMsg("Opening your results…");
      setStep(3);
      await new Promise((r) => setTimeout(r, 600));
      // Keep overlay open — do NOT call setLoading(false) before navigation.
      router.push(`/results/${jobId}`);
      // Overlay stays mounted until Next.js unmounts this page.
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [paste, router, startIntegrityJob]);

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please upload a PDF file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("PDF must be under 10MB.");
        return;
      }
      void runPdfFlow(file);
    },
    [runPdfFlow],
  );

  const sampleCitations = [
    { label: "retracted" as const, dot: "bg-red-500", title: "Surgisphere COVID study" },
    { label: "cascade" as const, dot: "bg-orange-400", title: "Meta-analysis of antivirals" },
    { label: "clean" as const, dot: "bg-emerald-500", title: "Biostatistics in RCTs" },
    { label: "clean" as const, dot: "bg-emerald-500", title: "Viral immunology review" },
  ];

  return (
    <>
      <AnalysisLoadingOverlay open={loading} message={loadMsg} step={step} />
      <div className="rw-landing-shell rw-bg rw-grid">
        <div className="rw-landing-aurora" aria-hidden />
        <div className="rw-landing-orb rw-landing-orb--a" aria-hidden />
        <div className="rw-landing-orb rw-landing-orb--b" aria-hidden />

        <div className="relative z-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/35 to-transparent" />
          <SiteHeader />

          <main className="relative mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
            <section className="text-center">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
                RetractWatch
              </p>
              <h1 className="rw-h1 mt-4 text-5xl leading-[1.1] text-white sm:text-6xl lg:text-7xl">
                Detect retracted science
                <span className="mt-2 block bg-gradient-to-r from-slate-300 to-slate-500 bg-clip-text text-transparent sm:mt-3">
                  before your reviewers do
                </span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-slate-300 sm:text-xl">
                Upload a PDF or paste references. We extract the bibliography, resolve
                DOIs via CrossRef, match them against the Retraction Watch database
                (tens of thousands of public retraction records), scan cascades via
                Semantic Scholar, and show live progress while the scan runs.
              </p>
            </section>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {[
                "57K+ Retraction Watch records (reference index, not your upload)",
                "Cascade contamination detection",
                "Live scan progress",
              ].map((label) => (
                <span
                  key={label}
                  className="rw-stat-pill rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-300"
                >
                  {label}
                </span>
              ))}
            </div>

            <section className="mt-16 sm:mt-20">
              <h2 className="rw-h2 text-center text-base font-bold uppercase tracking-[0.2em] text-slate-400">
                How it works
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
                {[
                  {
                    icon: "📄",
                    title: "Upload your PDF",
                    body: "Drop your manuscript or paste references — we extract the bibliography.",
                  },
                  {
                    icon: "🔍",
                    title: "We scan retraction data",
                    body: "Each resolved reference is checked against the Retraction Watch index plus CrossRef and Semantic Scholar.",
                  },
                  {
                    icon: "📊",
                    title: "Get your integrity score",
                    body: "Direct + cascade detection with replacement suggestions; results save online so you can return to them.",
                  },
                ].map((s) => (
                  <div
                    key={s.title}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-blue-500/20 hover:bg-slate-900/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]"
                  >
                    <span className="text-3xl sm:text-4xl" aria-hidden>
                      {s.icon}
                    </span>
                    <p className="mt-3 text-lg font-semibold text-white">{s.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <p className="mt-10 text-center text-sm text-slate-500 sm:mt-12">
              Powered by{" "}
              <span className="font-medium text-slate-400">Retraction Watch</span>
              {" · "}
              <span className="font-medium text-slate-400">CrossRef</span>
              {" · "}
              <span className="font-medium text-slate-400">Semantic Scholar</span>
            </p>

            <section className="mt-6">
          <div
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById("pdf-input")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("pdf-input")?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDrag(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              onFile(f ?? null);
            }}
            className={`group relative mt-10 cursor-pointer select-none overflow-hidden rounded-2xl border-2 border-dashed p-12 sm:p-14 text-center transition-all duration-300 ${
              drag
                ? "scale-[1.02] border-blue-400 bg-blue-500/10 shadow-[0_0_60px_rgba(59,130,246,0.25)]"
                : "border-slate-600/60 bg-slate-900/40 hover:scale-[1.01] hover:border-blue-400/70 hover:bg-slate-900/60 hover:shadow-[0_0_40px_rgba(59,130,246,0.12)]"
            }`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/50 to-transparent" />
              <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-blue-400/50 to-transparent" />
            </div>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              id="pdf-input"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <span
              className={`mb-4 block text-5xl transition-transform duration-300 ${drag ? "scale-110" : "group-hover:scale-110"}`}
              aria-hidden
            >
              📄
            </span>
            <span className="block text-xl font-bold text-white">
              Drop your PDF here
            </span>
            <span className="mt-2 block text-base text-slate-400 transition-colors duration-200 group-hover:text-slate-300">
              or click anywhere to browse · text-based PDFs work best
            </span>
          </div>

              <p className="mt-4 text-center text-sm leading-relaxed text-slate-500">
                Your PDF is never stored. Processed and discarded immediately.
              </p>
            </section>

          {error && (
            <p className="mt-5 text-center text-base font-medium text-red-300">{error}</p>
          )}

          <div className="relative my-12 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              or
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
          </div>

          <label className="block text-sm font-semibold uppercase tracking-wider text-slate-400">
            Paste references (one per line)
          </label>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder="e.g. Smith J. Example study. Nature. 2020; doi:10.xxxx/..."
            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-5 py-4 font-mono text-base text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />

          <button
            type="button"
            onClick={() => void runPasteFlow()}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-base font-bold text-white shadow-lg shadow-blue-950/40 transition-all duration-300 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-900/50 hover:shadow-xl active:scale-[0.98]"
          >
            🔬 Analyze Bibliography
          </button>

            <section className="mt-16 sm:mt-20">
              <div className="mb-6 flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700/60" />
                <span className="flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-950/30 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-blue-300/80">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-400/70" />
                  Output preview
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700/60" />
              </div>

              <div className="rw-demo-frame">
                <div className="rw-demo-frame-inner">
                  <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                      Demo · not your real results
                    </span>
                    <span className="rounded border border-blue-500/20 bg-blue-950/40 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-blue-400/70">
                      Preview
                    </span>
                  </div>

                  <div className="pointer-events-none select-none p-4 text-left sm:p-5">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Integrity</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <svg viewBox="0 0 48 48" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden>
                            <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="5" />
                            <circle cx="24" cy="24" r="18" fill="none" stroke="#f87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="113" strokeDashoffset="44" />
                          </svg>
                          <div>
                            <p className="text-base font-bold leading-none text-white">
                              61<span className="text-[9px] font-normal text-slate-400">/100</span>
                            </p>
                            <p className="mt-0.5 text-[8px] font-semibold uppercase text-red-300">Risk</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-950/30 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-red-300/80">Historical</p>
                        <p className="mt-1.5 text-[9px] font-medium leading-snug text-white">Similar to Surgisphere COVID papers</p>
                        <p className="mt-1 text-[8px] text-red-200/70">Caught after <span className="font-bold text-white">18 mo</span></p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Downstream</p>
                        <p className="mt-1.5 text-xl font-bold leading-none text-orange-300">~340</p>
                        <p className="mt-0.5 text-[8px] text-slate-400">papers at risk</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3">
                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Citations</p>
                        <div className="mt-2 space-y-1.5">
                          {sampleCitations.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.dot}`} />
                              <span className="truncate text-[8px] text-slate-300">{r.title}</span>
                              <span
                                className={`ml-auto shrink-0 rounded px-1 py-0.5 text-[7px] font-semibold uppercase ${
                                  r.label === "retracted"
                                    ? "bg-red-900/60 text-red-200"
                                    : r.label === "cascade"
                                      ? "bg-orange-900/60 text-orange-200"
                                      : "bg-emerald-900/40 text-emerald-300"
                                }`}
                              >
                                {r.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Cascade map</p>
                        <svg viewBox="0 0 120 84" className="mt-1.5 w-full" aria-hidden>
                          <rect x="40" y="3" width="40" height="13" rx="3" fill="rgba(59,130,246,0.2)" stroke="rgba(96,165,250,0.45)" strokeWidth="0.8" />
                          <text x="60" y="12" textAnchor="middle" fontSize="4.5" fill="#e2e8f0" fontWeight="600">Your paper</text>
                          <line x1="60" y1="16" x2="18" y2="34" stroke="rgba(148,163,184,0.2)" strokeWidth="0.8" />
                          <line x1="60" y1="16" x2="60" y2="34" stroke="rgba(148,163,184,0.2)" strokeWidth="0.8" />
                          <line x1="60" y1="16" x2="102" y2="34" stroke="rgba(248,113,113,0.55)" strokeWidth="1" strokeDasharray="2 1.5" />
                          <path d="M60 16 Q34 28 20 48" fill="none" stroke="rgba(251,146,60,0.5)" strokeWidth="1" />
                          <rect x="4" y="34" width="28" height="12" rx="3" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.35)" strokeWidth="0.8" />
                          <text x="18" y="42" textAnchor="middle" fontSize="4" fill="#6ee7b7">clean</text>
                          <rect x="46" y="34" width="28" height="12" rx="3" fill="rgba(16,185,129,0.12)" stroke="rgba(52,211,153,0.35)" strokeWidth="0.8" />
                          <text x="60" y="42" textAnchor="middle" fontSize="4" fill="#6ee7b7">clean</text>
                          <rect x="88" y="34" width="28" height="12" rx="3" fill="rgba(185,28,28,0.3)" stroke="rgba(248,113,113,0.55)" strokeWidth="0.8" />
                          <text x="102" y="42" textAnchor="middle" fontSize="4" fill="#fca5a5" fontWeight="600">retracted</text>
                          <rect x="6" y="50" width="28" height="12" rx="3" fill="rgba(194,65,12,0.3)" stroke="rgba(251,146,60,0.55)" strokeWidth="0.8" />
                          <text x="20" y="58" textAnchor="middle" fontSize="4" fill="#fdba74" fontWeight="600">cascade</text>
                          <line x1="34" y1="56" x2="88" y2="50" stroke="rgba(248,113,113,0.25)" strokeWidth="0.7" strokeDasharray="2 1.5" />
                          <circle cx="10" cy="76" r="2" fill="#34d399" />
                          <text x="14" y="78" fontSize="4" fill="#64748b">clean</text>
                          <circle cx="38" cy="76" r="2" fill="#fb923c" />
                          <text x="42" y="78" fontSize="4" fill="#64748b">cascade</text>
                          <circle cx="72" cy="76" r="2" fill="#f87171" />
                          <text x="76" y="78" fontSize="4" fill="#64748b">retracted</text>
                        </svg>
                      </div>
                    </div>

                    <p className="mt-3 text-center text-[9px] text-slate-600">
                      Sample — 12-citation paper · 1 direct retraction · 1 cascade contamination detected
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-16 rounded-2xl border border-red-900/35 bg-gradient-to-b from-red-950/35 to-slate-950/80 p-6 sm:mt-20 sm:p-8">
              <h2 className="rw-h2 text-base font-bold uppercase tracking-[0.15em] text-red-300/90">⚠️ The stakes</h2>
              <ul className="mt-5 space-y-4 text-base leading-relaxed text-slate-300">
                <li>
                  The Wakefield vaccine paper was cited{" "}
                  <strong className="text-white">881 times</strong> after retraction.
                </li>
                <li>
                  The average retracted paper is still being cited{" "}
                  <strong className="text-white">25 times</strong> post-retraction.
                </li>
                <li>
                  Only <strong className="text-white">5.4%</strong> of those citations acknowledge the retraction.
                </li>
              </ul>
            </section>

            <section className="mt-16 sm:mt-20">
              <h2 className="rw-h2 text-center text-base font-bold uppercase tracking-[0.2em] text-slate-400">Who is this for</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
                {[
                  { icon: "🎓", title: "PhD students", body: "Check before your defense" },
                  { icon: "📝", title: "Journal authors", body: "Submit with confidence" },
                  { icon: "🔬", title: "Research labs", body: "Audit your team's work" },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 text-center sm:p-6 transition-all duration-300 hover:border-blue-500/20 hover:bg-slate-900/50"
                  >
                    <span className="text-3xl sm:text-4xl" aria-hidden>
                      {c.icon}
                    </span>
                    <p className="mt-2.5 text-lg font-semibold text-white">{c.title}</p>
                    <p className="mt-1 text-sm leading-snug text-slate-400">{c.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <footer className="relative z-10 border-t border-white/10 bg-slate-950/90">
            <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
              <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Data sources</p>
                  <p className="mt-3 text-base leading-relaxed text-slate-400">
                    Bibliographies are cross-checked against the public{" "}
                    <span className="font-medium text-slate-300">Retraction Watch</span>{" "}
                    corpus (<span className="font-medium text-slate-300">~57,393</span>{" "}
                    records). That is the reference-index size, not your upload.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Privacy &amp; methodology</p>
                  <p className="mt-3 text-base leading-relaxed text-slate-400">
                    We never store your paper. <span className="font-medium text-slate-300">Zero retention.</span>
                  </p>
                  <p className="mt-2 text-base leading-relaxed text-slate-500">
                    Direct + cascade detection — <span className="text-slate-400">2 levels deep</span>.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Product</p>
                  <p className="mt-3 text-base text-slate-400">Free. No account required.</p>
                  <p className="rw-h2 mt-2 text-xl text-slate-300">
                    Retract<span className="text-blue-400">Watch</span> <span className="text-slate-500">V2</span>
                  </p>
                </div>
              </div>
              <div className="mt-10 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-8 sm:flex-row sm:justify-between">
                <p className="text-center text-sm text-slate-600 sm:text-left">
                  © {new Date().getFullYear()} RetractWatch · Developed by <b>Naieem Qureshi</b>
                </p>
                <p className="text-center text-sm text-slate-600">Built for researchers</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
