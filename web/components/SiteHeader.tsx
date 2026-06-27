import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-white/[0.06] bg-slate-950/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6 sm:py-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-[0_0_24px_rgba(59,130,246,0.3)] transition-all duration-300 group-hover:shadow-[0_0_32px_rgba(59,130,246,0.5)] group-hover:border-blue-400/40 overflow-hidden"
            aria-hidden
          >
            <Image
              src="/retractwatch-logo.png"
              alt="RetractWatch logo"
              width={44}
              height={44}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Retract<span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Watch</span>
            </p>
            <p className="truncate text-xs text-slate-400 sm:text-sm">
              Bibliography integrity for serious research
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <p className="hidden text-right text-xs leading-tight text-slate-500 sm:block sm:max-w-[220px]">
            Retraction Watch · CrossRef · Semantic Scholar
          </p>
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-500/15 bg-blue-950/20 px-3 py-2 sm:px-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              V2
            </span>
            <span className="h-3.5 w-px bg-white/15" aria-hidden />
            <span
              className="text-xs font-medium text-slate-400"
              title="Public Retraction Watch index (~57K records). Your references are matched against this database."
            >
              RW index · 57K+
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
