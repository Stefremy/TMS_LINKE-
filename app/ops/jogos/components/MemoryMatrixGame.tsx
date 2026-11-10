"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Play, RotateCcw, Heart, Award, Shuffle } from "lucide-react"
import { playNote, playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import { createRng, getLisbonDateKey, shuffleArray } from "../lib/puzzle-generator"
import type { GameCompletionEvent } from "../types"

interface MatrixConfig {
  level: number
  size: number
  activeCount: number
  displayMs: number
}

function getLevelConfig(lvl: number): MatrixConfig {
  if (lvl <= 2) return { level: lvl, size: 3, activeCount: 2 + lvl, displayMs: 1400 }
  if (lvl <= 5) return { level: lvl, size: 4, activeCount: lvl + 1, displayMs: 1500 }
  if (lvl <= 8) return { level: lvl, size: 5, activeCount: lvl + 2, displayMs: 1600 }
  return { level: lvl, size: 5, activeCount: Math.min(13, lvl + 2), displayMs: 1700 }
}

function pickSeededPattern(dailyKey: string, variant: number, lvl: number, size: number, activeCount: number): Set<number> {
  const rng = createRng(`${dailyKey}|memory|v${variant}|L${lvl}`)
  const allIndices = Array.from({ length: size * size }, (_, i) => i)
  const shuffled = shuffleArray(allIndices, rng)
  return new Set(shuffled.slice(0, Math.min(activeCount, allIndices.length)))
}

export function MemoryMatrixGame({
  dailyKey,
  onComplete,
}: {
  dailyKey?: string
  onComplete: (event: GameCompletionEvent) => void
}) {
  const effectiveDailyKey = dailyKey || getLisbonDateKey()
  const [variant, setVariant] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<"idle" | "memorize" | "recall" | "game_over">("idle")
  const [activeCells, setActiveCells] = useState<Set<number>>(new Set())
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set())
  const [wrongCells, setWrongCells] = useState<Set<number>>(new Set())
  const [score, setScore] = useState(0)

  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current)
      phaseTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  // Track active play elapsed time safely inside an effect interval
  useEffect(() => {
    if (gameState !== "memorize" && gameState !== "recall") return
    const tickStart = Date.now()
    const baseElapsed = elapsedRef.current
    const interval = setInterval(() => {
      elapsedRef.current = baseElapsed + (Date.now() - tickStart)
    }, 200)
    return () => {
      elapsedRef.current = baseElapsed + (Date.now() - tickStart)
      clearInterval(interval)
    }
  }, [gameState])

  const config = getLevelConfig(level)
  const totalCells = config.size * config.size

  const startLevel = useCallback(
    (lvl: number, activeVariant: number) => {
      clearTimers()
      const cfg = getLevelConfig(lvl)
      const picked = pickSeededPattern(
        effectiveDailyKey,
        activeVariant,
        lvl,
        cfg.size,
        cfg.activeCount
      )

      setActiveCells(picked)
      setSelectedCells(new Set())
      setWrongCells(new Set())
      setGameState("memorize")

      playNote(400, 0.1, "sine")

      phaseTimerRef.current = setTimeout(() => {
        setGameState("recall")
        playNote(600, 0.12, "sine")
      }, cfg.displayMs)
    },
    [clearTimers, effectiveDailyKey]
  )

  const startGame = (nextVariant = variant) => {
    elapsedRef.current = 0
    setVariant(nextVariant)
    setLevel(1)
    setLives(3)
    setScore(0)
    startLevel(1, nextVariant)
  }

  const handleCellClick = (idx: number) => {
    if (gameState !== "recall") return
    if (selectedCells.has(idx) || wrongCells.has(idx)) return

    if (activeCells.has(idx)) {
      const newSelected = new Set(selectedCells)
      newSelected.add(idx)
      setSelectedCells(newSelected)
      playStepSound(newSelected.size)

      const pts = level * 150
      const updatedScore = score + pts
      setScore(updatedScore)

      if (newSelected.size === activeCells.size) {
        playSuccessChime()
        const nextLvl = level + 1
        setLevel(nextLvl)
        setGameState("memorize")
        clearTimers()
        phaseTimerRef.current = setTimeout(() => {
          startLevel(nextLvl, variant)
        }, 700)
      }
    } else {
      playErrorBuzz()
      const newWrong = new Set(wrongCells)
      newWrong.add(idx)
      setWrongCells(newWrong)

      const remainingLives = lives - 1
      setLives(remainingLives)

      if (remainingLives <= 0) {
        clearTimers()
        setGameState("game_over")
        onComplete({
          gameId: "memory_matrix",
          score: Math.max(score, 100),
          level,
          timeMs: elapsedRef.current,
          moves: selectedCells.size + 1,
        })
      }
    }
  }

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-500">
              Nível {level} • Matriz {config.size}x{config.size}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-bold uppercase">
              {variant === 0 ? "Diário" : `Aleatório #${variant}`}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Pontuação: <span className="font-bold font-mono text-purple-600 dark:text-purple-400">{score} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 mr-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-colors ${
                  i < lives
                    ? "fill-rose-500 text-rose-500"
                    : "fill-zinc-300 dark:fill-zinc-700 text-zinc-300 dark:text-zinc-700"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => startGame(variant + 1)}
            title="Novo padrão aleatório"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={() => startGame(variant)}
            title="Reiniciar jogo"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div
        className="p-3 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md touch-none"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`,
          gap: "6px",
          width: "310px",
          height: "310px",
        }}
      >
        {gameState === "idle" ? (
          <div className="col-span-full h-full flex flex-col items-center justify-center gap-3 text-center p-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Preparado para testar a memória?</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Memorize os quadrados roxos do desafio de hoje e reproduza o padrão.
              </p>
            </div>
            <button
              onClick={() => startGame(variant)}
              className="mt-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-transform active:scale-95"
            >
              Começar Desafio
            </button>
          </div>
        ) : (
          Array.from({ length: totalCells }).map((_, idx) => {
            const isMemorizeActive = gameState === "memorize" && activeCells.has(idx)
            const isSelectedCorrect = selectedCells.has(idx)
            const isWrong = wrongCells.has(idx)
            const isRevealAtEnd = gameState === "game_over" && activeCells.has(idx) && !selectedCells.has(idx)

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                disabled={gameState !== "recall"}
                className={`relative rounded-xl transition-all ${
                  isMemorizeActive
                    ? "bg-purple-600 shadow-md scale-95"
                    : isSelectedCorrect
                    ? "bg-purple-600 text-white shadow-xs"
                    : isWrong
                    ? "bg-rose-500 text-white shadow-xs animate-shake"
                    : isRevealAtEnd
                    ? "bg-purple-300 dark:bg-purple-900/60 border-2 border-dashed border-purple-500"
                    : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]"
                }`}
              />
            )
          })
        )}
      </div>

      {/* State / Hint */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span className="font-medium">
          {gameState === "memorize" && "Memorize o padrão..."}
          {gameState === "recall" && `Encontre ${activeCells.size - selectedCells.size} células restantes`}
          {gameState === "game_over" && "Fim do Jogo"}
          {gameState === "idle" && "3 Vidas • Padrões renovados todos os dias"}
        </span>

        {gameState === "recall" && (
          <span className="text-purple-600 dark:text-purple-400 font-semibold">
            {selectedCells.size}/{activeCells.size}
          </span>
        )}
      </div>

      {/* Game Over Modal Banner */}
      {gameState === "game_over" && (
        <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 flex flex-col gap-2 items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <Award className="w-6 h-6 text-purple-500" />
          <div className="font-bold text-sm">Jogo Concluído no Nível {level}!</div>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Pontuação total enviada para o Ranking: <strong className="font-bold font-mono text-sm">{score} XP</strong>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => startGame(variant + 1)}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1"
            >
              <Shuffle className="w-3.5 h-3.5" /> Novo Desafio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
