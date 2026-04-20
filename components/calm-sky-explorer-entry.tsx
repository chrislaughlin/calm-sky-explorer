"use client";

import dynamic from "next/dynamic";

const CalmSkyExplorer = dynamic(
  () => import("@/components/calm-sky-explorer"),
  {
    ssr: false,
    loading: () => (
      <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,rgba(209,231,255,0.86),rgba(240,247,255,0.95)_42%,rgba(251,253,255,1)_100%)] text-slate-900">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
        <div className="relative mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col justify-between px-5 py-8">
          <section className="space-y-4">
            <span className="inline-flex items-center rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-[0_12px_32px_rgba(138,170,211,0.18)] backdrop-blur-sm">
              Calm Sky Explorer
            </span>
            <div className="max-w-sm space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Finding a softer way to ask where that plane is going.
              </h1>
              <p className="max-w-xs text-sm leading-6 text-slate-600">
                Loading the map, location prompt, and live aircraft layer.
              </p>
            </div>
          </section>
          <div className="rounded-[2rem] border border-white/75 bg-white/80 p-5 shadow-[0_18px_40px_rgba(115,148,191,0.18)] backdrop-blur-xl">
            <div className="h-3 w-28 animate-pulse rounded-full bg-sky-100" />
            <div className="mt-4 h-44 animate-pulse rounded-[1.5rem] bg-sky-50/90" />
          </div>
        </div>
      </main>
    ),
  }
);

export default function CalmSkyExplorerEntry() {
  return <CalmSkyExplorer />;
}
