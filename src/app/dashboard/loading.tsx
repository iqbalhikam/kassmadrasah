export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 animate-pulse">
      {/* Skeleton Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-800" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded bg-slate-800" />
              <div className="h-3 w-20 rounded bg-slate-800/60" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-20 rounded-lg bg-slate-800" />
            <div className="h-8 w-8 rounded-full bg-slate-800" />
          </div>
        </div>
      </header>

      {/* Skeleton Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 space-y-5">
        {/* Header Title Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-64 rounded-lg bg-slate-800" />
            <div className="h-3.5 w-96 rounded bg-slate-800/60" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-32 rounded-xl bg-slate-800" />
            <div className="h-9 w-40 rounded-xl bg-slate-800" />
          </div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-24 rounded bg-slate-800" />
                <div className="h-8 w-8 rounded-xl bg-slate-800" />
              </div>
              <div className="h-7 w-36 rounded-lg bg-slate-800" />
              <div className="h-3 w-20 rounded bg-slate-800/50" />
            </div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="h-5 w-48 rounded bg-slate-800" />
          <div className="h-64 rounded-xl bg-slate-800/40" />
        </div>

        {/* Table Skeleton */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <div className="h-5 w-40 rounded bg-slate-800" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-800/30" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
