import { Skeleton } from "@/components/ui/motion"

/** Mostrado entre páginas do ops: título, cartões e tabela, como a maioria das páginas. */
export default function OpsLoading() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-5" role="status" aria-busy="true">
      <span className="sr-only">A carregar…</span>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-40" /></div>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-px overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-[var(--surface-bg)] p-4 sm:p-5">
            <div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-4 w-24" /></div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3"><Skeleton className="h-4 w-48" /></div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
