"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Play, RotateCcw, Heart, Award, CheckCircle2 } from "lucide-react"
import { playNote, playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
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

export function MemoryMatrixGame({
  onComplete,
}: {
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<"idle" | "memorize" | "recall" | "game_over">("idle")
  const [activeCells, setActiveCells] = useState<Set<number>>(new Set())
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set())
  const [wrongCells, setWrongCells] = useState<Set<number>>(new Set())
  const [score, setScore] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [totalTimeMs, setTotalTimeMs] = useState(0)

  const config = getLevelConfig(level)
  const totalCells = config.size * config.size

  const startLevel = useCallback((lvl: number) => {
    const cfg = getLevelConfig(lvl)
    const count = cfg.activeCount
    const allIndices = Array.from({ length: cfg.size * cfg.size }, (_, i) => i)

    // Pick random unique indices
    const picked = new Set<number>()
    while (picked.size < count) {
      const randIdx = allIndices[Math.floor(Math.random() * allIndices.length)]
      picked.add(randIdx)
    }

    setActiveCells(picked)
    setSelectedCells(new Set())
    setWrongCells(new Set())
    setGameState("memorize")

    playNote(400, 0.1, "sine")

    setTimeout(() => {
      setGameState("recall")
      playNote(600, 0.12, "sine")
    }, cfg.displayMs)
  }, [])

  const startGame = () => {
    setLevel(1)
    setLives(3)
    setScore(0)
    setTotalTimeMs(0)
    setStartTime(Date.now())
    startLevel(1)
  }

  const handleCellClick = (idx: number) => {
    if (gameState !== "recall") return
    if (selectedCells.has(idx) || wrongCells.has(idx)) return

    if (activeCells.has(idx)) {
      // Correct!
      const newSelected = new Set(selectedCells)
      newSelected.add(idx)
      setSelectedCells(newSelected)
      playStepSound(newSelected.size)

      const pts = level * 150
      setScore(s => s + pts)

      // Checked all?
      if (newSelected.size === activeCells.size) {
        // Level cleared!
        playSuccessChime()
        const nextLvl = level + 1
        setLevel(nextLvl)
        setGameState("memorize")
        setTimeout(() => {
          startLevel(nextLvl)
        }, 800)
      }
    } else {
      // Wrong!
      playErrorBuzz()
      const newWrong = new Set(wrongCells)
      newWrong.add(idx)
      setWrongCells(newWrong)

      const remainingLives = lives - 1
      setLives(remainingLives)

      if (remainingLives <= 0) {
        // Game Over!
        setGameState("game_over")
        const elapsed = startTime > 0 ? Date.now() - startTime : 0
        setTotalTimeMs(elapsed)

        onComplete({
          gameId: "memory_matrix",
          score: Math.max(score, 100),
          level,
          timeMs: elapsed,
          moves: selectedCells.size + 1,
        })
      }
    }
  }

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-500">
            Nível {level} • Matriz {config.size}x{config.size}
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Pontuação: <span className="font-bold font-mono text-purple-600 dark:text-purple-400">{score} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Lives */}
          <div className="flex items-center gap-1">
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
            onClick={startGame}
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
              <p className="text-xs text-[var(--text-secondary)] mt-1">Memorize os quadrados roxos e reproduza o padrão.</p>
            </div>
            <button
              onClick={startGame}
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
          {gameState === "idle" && "3 Vidas • Aumenta de dificuldade"}
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
          <button
            onClick={startGame}
            className="mt-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs"
          >
            Jogar Novamente
          </button>
        </div>
      )}
    </div>
  )
}

