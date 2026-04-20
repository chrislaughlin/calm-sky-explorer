import Link from "next/link";

export default function SkyViewPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(210,231,255,0.9),rgba(244,249,255,0.96)_44%,rgba(252,253,255,1)_100%)] px-5 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-screen-sm flex-col justify-between">
        <section className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-[0_14px_34px_rgba(125,158,204,0.15)] backdrop-blur-sm"
          >
            Back to map
          </Link>
          <div className="max-w-md space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
              Sky View placeholder
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              AR sky pointing is saved for a later pass.
            </h1>
            <p className="text-base leading-7 text-slate-600">
              The MVP keeps this route visible so the future feature has a real
              home without pretending the browser can already place flights in
              the sky.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/75 bg-white/86 p-6 shadow-[0_24px_56px_rgba(108,139,184,0.18)] backdrop-blur-xl">
          <div className="space-y-5">
            <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(226,239,255,0.9),rgba(244,249,255,0.98))] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
                What fits here later
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Device orientation and compass calibration.</li>
                <li>Camera permission and a sky-facing overlay surface.</li>
                <li>Projection of selected nearby flights into view-space.</li>
              </ul>
            </div>

            {/* TODO: Future WebXR and orientation logic can live on this route,
                using the selected aircraft feed plus device heading to place
                plane cues against the live sky view. */}
            <p className="text-sm leading-6 text-slate-500">
              For now, this page is intentionally simple and non-functional so
              the app can ship a clear roadmap seam without overpromising AR.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
