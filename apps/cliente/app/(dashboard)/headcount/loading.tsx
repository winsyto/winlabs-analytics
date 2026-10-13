export default function HeadcountLoading() {
  return (
    <div
      className="flex h-full min-h-[640px] flex-col gap-3 p-4"
      role="status"
      aria-label="Cargando headcount"
    >
      <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      <div className="h-8 w-full max-w-3xl animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/60" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3 lg:grid-rows-2">
        <div className="animate-pulse rounded-lg border bg-muted/60 lg:col-span-2" />
        <div className="animate-pulse rounded-lg border bg-muted/60" />
        <div className="animate-pulse rounded-lg border bg-muted/60 lg:col-span-2" />
        <div className="animate-pulse rounded-lg border bg-muted/60" />
      </div>
    </div>
  );
}
