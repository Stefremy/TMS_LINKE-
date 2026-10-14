import type { ReactNode } from "react"

export default async function ClientAreaLayout({ children }: { children: ReactNode }) {
  // Login is public. Every store page/layout and legacy redirect checks access itself.
  return children
}
