"use client"

import * as React from "react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"

type Scope = { client: Cliente; isEmployee: boolean }
const ClientScopeContext = React.createContext<Scope | null>(null)

export function ClientScopeProvider({ value, children }: { value: Scope; children: React.ReactNode }) {
  return <ClientScopeContext.Provider value={value}>{children}</ClientScopeContext.Provider>
}

export function useClientScope(): Scope {
  const scope = React.useContext(ClientScopeContext)
  if (!scope) throw new Error("Área de cliente sem conta selecionada")
  return scope
}
