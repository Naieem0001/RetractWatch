import React from "react";

export interface HistoricalComparisonData {
  matchedCase: string;
  similarity: string;
  avgMonthsToCatch: number;
  impactDescription: string;
  severity: string;
}

interface Props {
  comparison?: HistoricalComparisonData | null;
}

export function HistoricalComparison({ comparison }: Props) {
  if (!comparison || comparison.severity === "clean") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/40 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md transition-all hover:border-emerald-500/30">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl rw-glow-pulse" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Historical Comparison</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            No major contamination detected. Your bibliography is cleaner than most.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-[var(--rw-card)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:border-red-500/30">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/20 blur-3xl rw-glow-pulse" />
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </span>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
            Historical Risk
          </h3>
        </div>
        <p className="mt-4 text-base font-semibold leading-tight text-white">
          {comparison.similarity} <span className="bg-gradient-to-r from-red-400 to-rose-300 bg-clip-text text-transparent">{comparison.matchedCase}</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Papers with this contamination profile took an average of{" "}
          <strong className="font-bold text-white">{comparison.avgMonthsToCatch} months</strong> to be caught in peer review.
        </p>
        <div className="mt-4 rounded-lg border border-red-500/10 bg-red-950/20 p-3">
          <p className="text-xs italic leading-relaxed text-red-300/90">
            "{comparison.impactDescription}"
          </p>
        </div>
      </div>
    </div>
  );
}
