"use client"

import * as React from "react"
import { Check, Monitor, Palette } from "lucide-react"
import {
  applyInterfaceTheme,
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribeToThemeChanges,
  type InterfaceTheme,
} from "@/components/theme/ThemeProvider"

const choices: { id: InterfaceTheme; name: string; description: string }[] = [
  { id: "linke", name: "Linke atual", description: "Visual claro, discreto e alinhado com a marca." },
  { id: "linke-vibrant", name: "Linke turquesa", description: "Turquesa na navegação, com apontamentos verde-lima da marca." },
  { id: "linke-four", name: "Linke 4 Cores", description: "Turquesa, verde-lima, azul nos botões da barra e texto verde-petróleo." },
  { id: "linke-noir", name: "Linke Noir", description: "Grafite e azul-petróleo, com realces turquesa." },
  { id: "terminal-dos", name: "Terminal DOS", description: "Ecrã escuro, texto monoespaçado e detalhes âmbar." },
  { id: "gameboy", name: "Game Boy", description: "Verdes clássicos e interface de inspiração portátil." },
  { id: "fallout-pipboy", name: "Fallout 4 Pip-Boy", description: "Ecrã escuro, fósforo verde e controlos retro." },
  { id: "win98", name: "Windows 98", description: "Cinza clássico, azul-marinho e botões em relevo." },
  { id: "winxp", name: "Windows XP", description: "Azul Luna, verdes clássicos e botões com relevo." },
]

export function ThemeSettings() {
  const selected = React.useSyncExternalStore(subscribeToThemeChanges, getThemeSnapshot, getServerThemeSnapshot)

  const selectTheme = (theme: InterfaceTheme) => {
    applyInterfaceTheme(theme)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-[var(--shadow-layer)]">
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
          <Palette className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tema da interface</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Escolhe a aparência deste acesso. A preferência fica guardada neste navegador.</p>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {choices.map((choice) => {
          const active = selected === choice.id
          const preview = {
            frame: choice.id === "win98" ? "border-[#404040] bg-[#c0c0c0]" : choice.id === "winxp" ? "rounded-md border-[#245edb] bg-[#eaf3ff]" : choice.id === "linke-vibrant" || choice.id === "linke-four" ? "border-[#126e68] bg-[#f7f8f4]" : choice.id === "linke-noir" ? "border-[#35494b] bg-[#172123]" : choice.id === "terminal-dos" ? "border-[#66542b] bg-[#070b08]" : choice.id === "gameboy" ? "border-[#586c4d] bg-[#d5dfad]" : choice.id === "fallout-pipboy" ? "border-[#68883c] bg-[#080d07]" : "border-slate-200 bg-slate-50",
            bar: choice.id === "win98" ? "bg-[#000080]" : choice.id === "winxp" ? "bg-gradient-to-b from-[#4a8df6] to-[#1553bb]" : choice.id === "linke-vibrant" || choice.id === "linke-four" ? "bg-[#188b80]" : choice.id === "linke-noir" ? "bg-[#102c2c]" : choice.id === "terminal-dos" ? "bg-[#121a11]" : choice.id === "gameboy" ? "bg-[#485d41]" : choice.id === "fallout-pipboy" ? "bg-[#263b1b]" : "bg-white",
            line: choice.id === "win98" || choice.id === "winxp" || choice.id === "linke-noir" || choice.id === "terminal-dos" || choice.id === "gameboy" || choice.id === "fallout-pipboy" ? "bg-white/90" : "bg-slate-300",
            panel: choice.id === "win98" ? "border-[#808080] bg-[#d4d0c8] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080]" : choice.id === "winxp" ? "rounded border-[#9ab9ed] bg-white" : choice.id === "linke-vibrant" || choice.id === "linke-four" ? "rounded-md border-[#d9e6d4] bg-white" : choice.id === "linke-noir" ? "border-[#35494b] bg-[#273537]" : choice.id === "terminal-dos" ? "border-[#536244] bg-[#11180e]" : choice.id === "gameboy" ? "border-[#89996a] bg-[#e8efc5]" : choice.id === "fallout-pipboy" ? "border-[#445b30] bg-[#141e0e]" : "rounded-md border-slate-200 bg-white",
            button: choice.id === "win98" ? "border border-[#404040] bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080]" : choice.id === "winxp" ? "rounded border border-[#6492d8] bg-gradient-to-b from-[#fff] via-[#dceaff] to-[#b5d0f5] shadow-[inset_1px_1px_#fff]" : choice.id === "linke-vibrant" ? "rounded-md bg-[#c0f35c]" : choice.id === "linke-four" ? "rounded-md bg-[#246caf]" : choice.id === "linke-noir" ? "rounded bg-[#39b8a5]" : choice.id === "terminal-dos" ? "border border-[#b99238] bg-[#332811]" : choice.id === "gameboy" ? "border border-[#536c48] bg-[#9eb478]" : choice.id === "fallout-pipboy" ? "border border-[#9ac64d] bg-[#25391a]" : "rounded-md bg-[#128a47]",
          }
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectTheme(choice.id)}
              className={`group rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]/40" : "border-[var(--border-subtle)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)]"}`}
            >
              <div className={`mb-3 overflow-hidden border ${preview.frame}`}>
                <div className={`flex h-5 items-center px-2 ${preview.bar}`}>
                  <span className={`h-1.5 w-12 rounded-full ${preview.line}`} />
                </div>
                <div className="flex h-12 items-center gap-2 p-2">
                  <span className={`h-7 w-7 border ${preview.panel}`} />
                  <span className={`h-3 flex-1 border ${choice.id === "win98" ? "border-[#808080] bg-[#d4d0c8] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080]" : preview.panel}`} />
                  <span className={`h-5 w-12 ${preview.button}`} />
                </div>
              </div>
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <Monitor className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />{choice.name}
                </span>
                {active && <Check className="h-4 w-4 text-[var(--accent)]" aria-label="Tema selecionado" />}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{choice.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
