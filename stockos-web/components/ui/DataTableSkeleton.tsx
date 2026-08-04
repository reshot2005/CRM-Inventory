export function DataTableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 rounded-lg border border-border p-3 animate-pulse"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 flex-1 rounded bg-muted"
              style={{ opacity: 1 - j * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
