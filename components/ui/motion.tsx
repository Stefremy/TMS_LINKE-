"use client"

/**
 * Micro-interações partilhadas (ops + portal do cliente).
 * Regras: só informam (algo mudou / ficou guardado / está a carregar), duram 150–450 ms,
 * nunca bloqueiam cliques e desligam-se com "reduzir movimento" do sistema.
 * As cores vêm dos tokens do tema, por isso funcionam também nos temas retro.
 */
import * as React from "react"

export type NumberFormat = {
  /** Casas decimais. Por omissão 0. */
  decimals?: number
  /** Texto colado ao número, ex.: "€", "%", "d". */
  suffix?: string
  /** Com locale usa separadores (ex.: "1 234,50"); sem locale usa toFixed (ex.: "1234.50"). */
  locale?: string
}

export function formatAnimatedNumber(value: number, { decimals = 0, suffix = "", locale }: NumberFormat = {}) {
  const safe = Number.isFinite(value) ? value : 0
  const text = locale
    ? safe.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : safe.toFixed(decimals)
  return `${text}${suffix}`
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Número que conta do valor anterior para o novo quando muda (ex.: ao trocar de mês).
 * No primeiro render mostra logo o valor final: sem "zeros" a piscar nem diferenças de hidratação.
 * Leitores de ecrã leem só o valor final.
 */
export function AnimatedNumber({ value, duration = 450, className, ...format }: NumberFormat & {
  value: number
  duration?: number
  className?: string
}) {
  const target = Number.isFinite(value) ? value : 0
  const [shown, setShown] = React.useState(target)
  const [changed, setChanged] = React.useState(false)
  const from = React.useRef(target)
  const frame = React.useRef<number | null>(null)

  React.useEffect(() => {
    const start = from.current
    if (start === target) return
    from.current = target
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    if (prefersReducedMotion() || duration <= 0) { setShown(target); return }
    setChanged(true)
    const began = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out: rápido no início, assenta no valor
      setShown(t >= 1 ? target : start + (target - start) * eased)
      frame.current = t < 1 ? requestAnimationFrame(tick) : null
      if (t >= 1) window.setTimeout(() => setChanged(false), 700)
    }
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }
  }, [target, duration])

  const finalText = formatAnimatedNumber(target, format)
  return (
    <span className={`${className ?? ""} ${changed ? "tms-value-changed" : ""}`.trim()}>
      <span aria-hidden="true">{formatAnimatedNumber(shown, format)}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  )
}

/**
 * Devolve uma classe que destaca brevemente um elemento quando `value` muda
 * (ex.: saldo projetado da wallet, linha de envio que mudou de estado). Ignora o 1.º render.
 */
export function useValueFlash(value: unknown, className = "tms-flash") {
  const previous = React.useRef(value)
  const [active, setActive] = React.useState(false)
  React.useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    setActive(false)
    const raf = requestAnimationFrame(() => setActive(true))
    const timer = window.setTimeout(() => setActive(false), 900)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer) }
  }, [value])
  return active ? className : ""
}

/** Bloco cinzento com brilho a passar, na forma do conteúdo que vai aparecer. */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={`tms-skeleton ${className}`} style={style} />
}
