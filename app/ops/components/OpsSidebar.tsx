"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronsLeft, ChevronsRight } from "lucide-react"
import { SidebarNav } from "./SidebarNav"

export function OpsSidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  // Load persistence from localStorage safely on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("linke_ops_sidebar_collapsed")
      if (saved !== null) {
        setIsCollapsed(saved === "true")
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem("linke_ops_sidebar_collapsed", String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <aside 
      className={`bg-[var(--surface-bg)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 transition-all duration-200 select-none ${
        isCollapsed ? "w-[68px]" : "w-full md:w-[220px]"
      }`}
    >
      {/* Logo Area */}
      <div className={`pt-6 pb-2 ${isCollapsed ? "px-2 flex flex-col items-center" : "px-6"}`}>
        <Link href="/ops" className="block">
          {isCollapsed ? (
            <div 
              title="Linke TMS"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105"
            >
              <Image 
                src="/favicon.png" 
                alt="Linke TMS" 
                width={36} 
                height={36} 
                className="object-contain rounded-lg" 
                priority 
              />
            </div>
          ) : (
            <>
              <Image 
                src="/Linke-logo.png" 
                alt="Linke TMS" 
                width={130} 
                height={32} 
                className="object-contain" 
                priority 
              />
              <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-2">
                v2.8.4 Enterprise
              </div>
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <SidebarNav collapsed={isCollapsed} />

      {/* Bottom Sidebar Action: Recolher painel */}
      <div className={`pb-4 pt-2 ${isCollapsed ? "px-2" : "px-4"}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expandir painel" : "Recolher painel"}
          className={`w-full flex items-center rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.04)] transition-all cursor-pointer ${
            isCollapsed 
              ? "h-10 justify-center p-0" 
              : "px-3 py-2 justify-between"
          }`}
        >
          {isCollapsed ? (
            <ChevronsRight className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <>
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Recolher painel</span>
              <ChevronsLeft className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
