"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DashboardBackdrop } from "./DashboardBackdrop"
import styles from "./DashboardBackdrop.module.css"

const decoratedPages = new Set([
  "/ops", "/ops/envios", "/ops/envios/novo", "/ops/tracking", "/ops/envios/recolhas", "/ops/calendario",
  "/ops/entidades/clientes", "/ops/entidades/fornecedores", "/ops/entidades/colaboradores",
  "/ops/configuracao/servicos", "/ops/faturacao/contas-corrente", "/ops/faturacao/clientes", "/ops/faturacao/estatistica",
  "/ops/tesouraria/reembolsos", "/ops/tesouraria/reconciliacao",
  "/ops/documentos", "/ops/configuracao/webservices", "/ops/configuracao/notificacoes", "/ops/chat",
])

export function OpsPageSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const decorated = decoratedPages.has(pathname.replace(/\/$/, ""))

  return (
    <main className={`tms-main flex-1 bg-[var(--canvas-bg)] ${decorated ? styles.dashboard : ""}`}>
      {decorated && <DashboardBackdrop />}
      {children}
    </main>
  )
}
