import type { Viewport } from "next"
import type { ReactNode } from "react"

export const viewport: Viewport = { viewportFit: "cover" }

export default async function ClientAreaLayout({ children }: { children: ReactNode }) {
  // Login is public. Every store page/layout and legacy redirect checks access itself.
  return children
}
