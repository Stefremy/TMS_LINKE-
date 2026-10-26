"use client"

import React, { useState } from "react"
import { Calculator, X } from "lucide-react"
import { NeumorphicCalculator } from "./NeumorphicCalculator"
import styles from "./FloatingCalculatorWidget.module.css"

export function FloatingCalculatorWidget({ placement = "floating" }: { placement?: "floating" | "inline" }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className={placement === "inline" ? "relative z-40 select-none print:hidden" : "fixed bottom-6 right-6 z-40 select-none print:hidden"}>
        <button
          type="button"
          onClick={() => setIsOpen(open => !open)}
          title={isOpen ? "Fechar calculadora (Esc)" : "Abrir calculadora"}
          aria-label={isOpen ? "Fechar calculadora" : "Abrir calculadora"}
          aria-expanded={isOpen}
          className={`${styles.button} ${placement === "floating" ? styles.compact : ""}`}
        >
          <Calculator className={styles.icon} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.reading}>
            <span className={styles.title}>Calculadora</span>
          </span>
          {isOpen && <X className={styles.closeIcon} aria-hidden="true" />}
        </button>
      </div>

      <NeumorphicCalculator isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
