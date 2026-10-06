export default function ClientAreaLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="A carregar">
      <div className="h-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" />
        ))}
      </div>
      <div className="h-80 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" />
    </div>
  )
}
