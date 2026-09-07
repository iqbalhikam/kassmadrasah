export default function ReportLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 animate-pulse">
      {/* Skeleton Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-800" />
            <div className="h-4 w-36 rounded bg-slate-800" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-28 rounded-xl bg-slate-800" />
            <div className="h-9 w-32 rounded-xl bg-slate-800" />
          </div>
        </div>
      </header>

      {/* Skeleton A4 Preview Sheet */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 flex flex-col items-center">
        <div className="w-full max-w-[794px] min-h-[1123px] bg-slate-900/60 rounded-xl border border-slate-800 p-8 space-y-6 shadow-2xl">
          {/* Kop Skeleton */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <div className="h-16 w-16 rounded-full bg-slate-800" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-64 rounded bg-slate-800" />
              <div className="h-3.5 w-80 rounded bg-slate-800/60" />
            </div>
          </div>
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 rounded-lg bg-slate-800/60" />
            <div className="h-16 rounded-lg bg-slate-800/60" />
            <div className="h-16 rounded-lg bg-slate-800/60" />
          </div>
          {/* Table Rows Skeleton */}
          <div className="space-y-3 pt-4">
            <div className="h-8 rounded bg-slate-800" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-7 rounded bg-slate-800/40" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
