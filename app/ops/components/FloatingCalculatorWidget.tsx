"use client"

import React, { useState } from "react"
import { Calculator, X } from "lucide-react"
import { NeumorphicCalculator } from "./NeumorphicCalculator"

export function FloatingCalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Neumorphic Action Button (docked bottom-right) */}
      <div className="fixed bottom-6 right-6 z-40 select-none print:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? "Fechar Calculadora (Esc)" : "Abrir Calculadora Neumórfica (Figma)"}
          style={{
            backgroundColor: "#eef2f6",
            boxShadow: isOpen
              ? "inset 3px 3px 6px #cad4e2, inset -3px -3px 6px #ffffff"
              : "6px 6px 14px rgba(166, 180, 200, 0.45), -6px -6px 14px #ffffff",
          }}
          className={`group flex items-center gap-2.5 h-12 px-4 rounded-full border border-white/60 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${
            isOpen ? "ring-2 ring-teal-500/40 text-teal-600" : "text-slate-700 hover:text-teal-600"
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1cd8c1] to-[#0ebfa9] text-white flex items-center justify-center shadow-xs shrink-0 group-hover:rotate-12 transition-transform">
            {isOpen ? <X className="w-4 h-4" /> : <Calculator className="w-4 h-4" />}
          </div>
          <div className="flex flex-col text-left pr-1">
            <span className="font-mono text-xs font-bold leading-tight tracking-tight">
              Calculadora
            </span>
            <span className="text-[9px] uppercase tracking-widest text-teal-600 font-semibold leading-none">
              NEUMORPHIC
            </span>
          </div>
        </button>
      </div>

      {/* Neumorphic Calculator Modal/Widget */}
      <NeumorphicCalculator isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
