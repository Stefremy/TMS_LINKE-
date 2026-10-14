"use client"

export default function ClientesError({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-6 space-y-3" role="alert">
      <h1 className="text-lg font-bold text-[var(--text-primary)]">Não foi possível carregar os clientes</h1>
      <p className="text-sm text-[var(--text-secondary)]">
        A lista está temporariamente indisponível. Tenta novamente para consultar os clientes da equipa.
      </p>
      <button type="button" onClick={retry}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white cursor-pointer">
        Tentar novamente
      </button>
    </div>
  )
}
