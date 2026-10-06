export default function OpsLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="A carregar">
      <div className="h-7 w-56 rounded-md bg-[var(--surface-muted)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" />
        ))}
      </div>
      <div className="h-80 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" />
    </div>
  )
}
