import { Skeleton } from "@/components/ui/motion"

/** Mostrado entre páginas do portal do cliente. */
export default function ClientAreaLoading() {
  return (
    <div className="space-y-5" role="status" aria-busy="true">
      <span className="sr-only">A carregar…</span>
      <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-40" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-[var(--surface-bg)] p-4 sm:p-5">
            <div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-4 w-24" /></div>
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="space-y-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
    </div>
  )
}
