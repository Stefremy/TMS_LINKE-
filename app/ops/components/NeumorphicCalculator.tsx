"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Copy, Check, X, RotateCcw, Box, Calculator as CalcIcon, Move } from "lucide-react"

interface NeumorphicCalculatorProps {
  isOpen: boolean
  onClose: () => void
  initialPosition?: { x: number; y: number }
}

export function NeumorphicCalculator({ isOpen, onClose }: NeumorphicCalculatorProps) {
  const [display, setDisplay] = useState("0")
  const [expression, setExpression] = useState("")
  const [prevValue, setPrevValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const [quickMode, setQuickMode] = useState<"standard" | "volumetric">("standard")
  
  // Volumetric inputs
  const [length, setLength] = useState("")
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [divisor, setDivisor] = useState<4000 | 5000>(4000)

  // Floating draggable state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Set default position on mount (bottom-right floating or centered on mobile)
  useEffect(() => {
    if (typeof window !== "undefined" && !position) {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        setPosition({ x: Math.max(10, (window.innerWidth - 320) / 2), y: 80 })
      } else {
        setPosition({ x: window.innerWidth - 360, y: window.innerHeight - 560 })
      }
    }
  }, [position])

  const triggerKeyFeedback = (key: string) => {
    setPressedKey(key)
    setTimeout(() => setPressedKey(null), 140)
  }

  const handleDigit = useCallback((digit: string) => {
    triggerKeyFeedback(digit)
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? digit : display + digit)
    }
  }, [display, waitingForOperand])

  const handleDecimal = useCallback(() => {
    triggerKeyFeedback(".")
    if (waitingForOperand) {
      setDisplay("0.")
      setWaitingForOperand(false)
    } else if (!display.includes(".")) {
      setDisplay(display + ".")
    }
  }, [display, waitingForOperand])

  const handleClear = useCallback(() => {
    triggerKeyFeedback("C")
    setDisplay("0")
    setExpression("")
    setPrevValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }, [])

  const handleToggleSign = useCallback(() => {
    triggerKeyFeedback("+/-")
    const num = parseFloat(display)
    if (!isNaN(num)) {
      setDisplay(String(-num))
    }
  }, [display])

  const handlePercent = useCallback(() => {
    triggerKeyFeedback("%")
    const num = parseFloat(display)
    if (!isNaN(num)) {
      const result = num / 100
      setDisplay(String(result))
      if (operator && prevValue !== null) {
        setExpression(`${prevValue} ${operator} ${result}`)
      }
    }
  }, [display, operator, prevValue])

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case "+":
        return first + second
      case "-":
        return first - second
      case "×":
      case "*":
        return first * second
      case "÷":
      case "/":
        return second !== 0 ? first / second : 0
      default:
        return second
    }
  }

  const handleOperator = useCallback((nextOperator: string) => {
    triggerKeyFeedback(nextOperator)
    const inputValue = parseFloat(display)

    if (prevValue === null) {
      setPrevValue(inputValue)
      setExpression(`${inputValue} ${nextOperator}`)
    } else if (operator) {
      const currentValue = prevValue || 0
      const newValue = calculate(currentValue, inputValue, operator)
      setPrevValue(newValue)
      setDisplay(String(Number(newValue.toFixed(6))))
      setExpression(`${Number(newValue.toFixed(6))} ${nextOperator}`)
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }, [display, prevValue, operator])

  const handleEquals = useCallback(() => {
    triggerKeyFeedback("=")
    const inputValue = parseFloat(display)

    if (operator && prevValue !== null) {
      const result = calculate(prevValue, inputValue, operator)
      const formattedResult = Number(result.toFixed(6))
      setExpression(`${prevValue} ${operator} ${inputValue}`)
      setDisplay(String(formattedResult))
      setPrevValue(null)
      setOperator(null)
      setWaitingForOperand(true)
    }
  }, [display, operator, prevValue])

  const handleBackspace = useCallback(() => {
    if (waitingForOperand) return
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay("0")
    }
  }, [display, waitingForOperand])

  const handleCopy = () => {
    navigator.clipboard.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Volumetric formula
  const computeVolumetric = () => {
    const l = parseFloat(length) || 0
    const w = parseFloat(width) || 0
    const h = parseFloat(height) || 0
    if (l > 0 && w > 0 && h > 0) {
      const weight = (l * w * h) / divisor
      const formatted = weight.toFixed(2)
      setDisplay(formatted)
      setExpression(`${l} × ${w} × ${h} ÷ ${divisor}`)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in standard inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) && quickMode !== "volumetric") {
        return
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === ".") {
        e.preventDefault()
        handleDecimal()
      } else if (e.key === "+" || e.key === "-") {
        e.preventDefault()
        handleOperator(e.key)
      } else if (e.key === "*") {
        e.preventDefault()
        handleOperator("×")
      } else if (e.key === "/") {
        e.preventDefault()
        handleOperator("÷")
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault()
        handleEquals()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "Backspace") {
        e.preventDefault()
        handleBackspace()
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault()
        handleClear()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleDigit, handleDecimal, handleOperator, handleEquals, handleBackspace, handleClear, onClose, quickMode])

  // Mouse Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    isDragging.current = true
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const newX = Math.max(10, Math.min(window.innerWidth - 330, e.clientX - dragOffset.current.x))
      const newY = Math.max(10, Math.min(window.innerHeight - 520, e.clientY - dragOffset.current.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      isDragging.current = false
    }

    if (isOpen) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Neumorphic styling tokens (Figma Neumorphic community spec)
  const baseBg = "#eef2f6" // Soft off-white neumorphic canvas
  
  return (
    <div
      ref={cardRef}
      style={{
        position: "fixed",
        left: position ? `${position.x}px` : "auto",
        top: position ? `${position.y}px` : "auto",
        right: position ? "auto" : "24px",
        bottom: position ? "auto" : "24px",
        zIndex: 9999,
      }}
      className="select-none animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Outer Neumorphic Card container matching Figma community file */}
      <div 
        className="w-[310px] sm:w-[320px] rounded-[32px] overflow-hidden transition-shadow"
        style={{
          backgroundColor: baseBg,
          boxShadow: "14px 14px 28px #cad4e2, -14px -14px 28px #ffffff",
        }}
      >
        {/* Top Header / Drag Bar */}
        <div 
          onMouseDown={handleMouseDown}
          className="bg-[#181a1f] px-4 pt-3 pb-1 flex items-center justify-between cursor-move rounded-t-[32px]"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(20,200,180,0.8)]" />
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-semibold">
              NEUMORPHIC CALC
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickMode(quickMode === "standard" ? "volumetric" : "standard")}
              title={quickMode === "standard" ? "Mudar para Cálculo Volumétrico CTT/DPD" : "Mudar para Calculadora Padrão"}
              className={`p-1 rounded-md text-[10px] font-mono font-medium transition-colors ${
                quickMode === "volumetric" 
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              <Box className="w-3.5 h-3.5 inline mr-1" />
              {quickMode === "volumetric" ? "VOL" : "STD"}
            </button>
            <button
              onClick={handleCopy}
              title="Copiar resultado"
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              title="Fechar (Esc)"
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Display Screen (Deep Black Curved Display as in Figma) */}
        <div className="bg-[#181a1f] px-6 pt-2 pb-5 text-right flex flex-col justify-end min-h-[96px]">
          {/* Subtle notch pill */}
          <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-3 opacity-60" />

          {/* Sub-line Expression (e.g. 120 × 10.5) */}
          <div className="text-[#687a92] font-mono text-xs sm:text-sm font-medium tracking-wide min-h-[18px] truncate">
            {expression || "\u00A0"}
          </div>

          {/* Main Digits (e.g. 1260) */}
          <div className="text-white font-mono font-bold text-3xl sm:text-4xl tracking-tight select-all truncate mt-0.5">
            {display}
          </div>
        </div>

        {/* Volumetric Helper Drawer (if toggled) */}
        {quickMode === "volumetric" && (
          <div className="p-4 border-b border-slate-300/60 bg-[#e4e9f0] text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
              <span>Peso Volumétrico (cm):</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDivisor(4000)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${divisor === 4000 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"}`}
                >
                  ÷4000 (DPD/CTT)
                </button>
                <button
                  type="button"
                  onClick={() => setDivisor(5000)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${divisor === 5000 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"}`}
                >
                  ÷5000 (Aéreo)
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                placeholder="Comp (cm)"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="px-2 py-1 bg-white/80 rounded-lg text-xs font-mono border border-slate-300 focus:outline-teal-500"
              />
              <input
                type="number"
                placeholder="Larg (cm)"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="px-2 py-1 bg-white/80 rounded-lg text-xs font-mono border border-slate-300 focus:outline-teal-500"
              />
              <input
                type="number"
                placeholder="Alt (cm)"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="px-2 py-1 bg-white/80 rounded-lg text-xs font-mono border border-slate-300 focus:outline-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={computeVolumetric}
              className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors"
            >
              Calcular Peso Volumétrico (kg)
            </button>
          </div>
        )}

        {/* Neumorphic Keypad Grid (Figma specification) */}
        <div className="p-4 sm:p-5 pt-4">
          <div className="grid grid-cols-4 gap-3">
            {/* ROW 1: C, +/-, %, ÷ */}
            <NeumorphicButton
              label="C"
              onClick={handleClear}
              isPressed={pressedKey === "C"}
              textClass="text-[#475569] font-bold text-base"
            />
            <NeumorphicButton
              label="+/-"
              onClick={handleToggleSign}
              isPressed={pressedKey === "+/-"}
              textClass="text-[#475569] font-bold text-sm"
            />
            <NeumorphicButton
              label="%"
              onClick={handlePercent}
              isPressed={pressedKey === "%"}
              textClass="text-[#475569] font-bold text-base"
            />
            <NeumorphicButton
              label="÷"
              onClick={() => handleOperator("÷")}
              isPressed={pressedKey === "÷"}
              textClass="text-[#6366f1] font-bold text-xl"
            />

            {/* ROW 2: 7, 8, 9, × */}
            <NeumorphicButton
              label="7"
              onClick={() => handleDigit("7")}
              isPressed={pressedKey === "7"}
            />
            <NeumorphicButton
              label="8"
              onClick={() => handleDigit("8")}
              isPressed={pressedKey === "8"}
            />
            <NeumorphicButton
              label="9"
              onClick={() => handleDigit("9")}
              isPressed={pressedKey === "9"}
            />
            <NeumorphicButton
              label="×"
              onClick={() => handleOperator("×")}
              isPressed={pressedKey === "×"}
              textClass="text-[#6366f1] font-bold text-xl"
            />

            {/* ROW 3: 4, 5, 6, - */}
            <NeumorphicButton
              label="4"
              onClick={() => handleDigit("4")}
              isPressed={pressedKey === "4"}
            />
            <NeumorphicButton
              label="5"
              onClick={() => handleDigit("5")}
              isPressed={pressedKey === "5"}
            />
            <NeumorphicButton
              label="6"
              onClick={() => handleDigit("6")}
              isPressed={pressedKey === "6"}
            />
            <NeumorphicButton
              label="-"
              onClick={() => handleOperator("-")}
              isPressed={pressedKey === "-"}
              textClass="text-[#6366f1] font-bold text-2xl"
            />

            {/* ROW 4: 1, 2, 3, + */}
            <NeumorphicButton
              label="1"
              onClick={() => handleDigit("1")}
              isPressed={pressedKey === "1"}
            />
            <NeumorphicButton
              label="2"
              onClick={() => handleDigit("2")}
              isPressed={pressedKey === "2"}
            />
            <NeumorphicButton
              label="3"
              onClick={() => handleDigit("3")}
              isPressed={pressedKey === "3"}
            />
            <NeumorphicButton
              label="+"
              onClick={() => handleOperator("+")}
              isPressed={pressedKey === "+"}
              textClass="text-[#6366f1] font-bold text-xl"
            />

            {/* ROW 5: 0, 00 / DEL, ., = */}
            <NeumorphicButton
              label="0"
              onClick={() => handleDigit("0")}
              isPressed={pressedKey === "0"}
            />
            <NeumorphicButton
              label="00"
              onClick={() => handleDigit("00")}
              isPressed={pressedKey === "00"}
              textClass="text-[#1e293b] font-bold text-sm"
            />
            <NeumorphicButton
              label="."
              onClick={handleDecimal}
              isPressed={pressedKey === "."}
              textClass="text-[#1e293b] font-bold text-2xl leading-none"
            />

            {/* Equals Button (=) - Distinct Turquoise Neumorphic Accent from Figma */}
            <button
              type="button"
              onClick={handleEquals}
              style={{
                background: "linear-gradient(135deg, #1cd8c1 0%, #0ebfa9 100%)",
                boxShadow: pressedKey === "=" 
                  ? "inset 2px 2px 5px rgba(0,0,0,0.3)" 
                  : "0 6px 14px rgba(20, 199, 178, 0.45), 3px 3px 6px #cad4e2, -3px -3px 6px #ffffff",
              }}
              className={`h-12 w-full rounded-2xl flex items-center justify-center text-white font-bold text-2xl transition-all duration-100 cursor-pointer active:scale-95 ${
                pressedKey === "=" ? "scale-95" : ""
              }`}
            >
              =
            </button>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="pb-3 text-center text-[10px] text-slate-400 font-mono tracking-wider">
          TECLADO ATIVO • ENTER =
        </div>
      </div>
    </div>
  )
}

interface NeumorphicButtonProps {
  label: string
  onClick: () => void
  isPressed?: boolean
  textClass?: string
}

function NeumorphicButton({
  label,
  onClick,
  isPressed = false,
  textClass = "text-[#1e293b] font-bold text-lg",
}: NeumorphicButtonProps) {
  const [internalActive, setInternalActive] = useState(false)
  const active = isPressed || internalActive

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setInternalActive(true)}
      onMouseUp={() => setInternalActive(false)}
      onMouseLeave={() => setInternalActive(false)}
      onTouchStart={() => setInternalActive(true)}
      onTouchEnd={() => setInternalActive(false)}
      style={{
        backgroundColor: "#eef2f6",
        boxShadow: active
          ? "inset 3px 3px 6px #c4cfdd, inset -3px -3px 6px #ffffff"
          : "4px 4px 8px #c8d2e0, -4px -4px 8px #ffffff",
        transition: "box-shadow 0.12s ease, transform 0.08s ease",
      }}
      className={`h-12 w-full rounded-2xl flex items-center justify-center font-mono select-none cursor-pointer active:scale-95 transition-transform ${textClass}`}
    >
      {label}
    </button>
  )
}
