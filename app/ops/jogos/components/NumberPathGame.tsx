"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { RotateCcw, CheckCircle2, ArrowRight, Undo2, Award } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import type { GameCompletionEvent } from "../types"

interface NumberPathLevel {
  levelNumber: number
  size: number
  title: string
  description: string
  waypoints: { [key: string]: number } // "r,c" => number label
  totalCells: number
}

const NUMBER_PATH_LEVELS: NumberPathLevel[] = [
  {
    levelNumber: 1,
    size: 4,
    title: "Nível 1 - Circuito Expresso (4x4)",
    description: "Ligue os números em ordem (1 ➔ 2 ➔ 3 ➔ 4 ➔ 5) percorrendo as casas.",
    waypoints: {
      "0,0": 1,
      "0,3": 2,
      "3,3": 3,
      "3,0": 4,
      "1,1": 5,
    },
    totalCells: 16,
  },
  {
    levelNumber: 2,
    size: 5,
    title: "Nível 2 - Trilha Logística (5x5)",
    description: "Conecte os marcos do armazém de 1 a 6 por passos ortogonais contíguos.",
    waypoints: {
      "0,0": 1,
      "0,4": 2,
      "2,2": 3,
      "4,4": 4,
      "4,0": 5,
      "2,0": 6,
    },
    totalCells: 25,
  },
  {
    levelNumber: 3,
    size: 5,
    title: "Nível 3 - Rota Otimizada (5x5)",
    description: "7 marcos numéricos sequenciais. Planeie cada curva com precisão.",
    waypoints: {
      "0,2": 1,
      "0,0": 2,
      "4,0": 3,
      "4,2": 4,
      "4,4": 5,
      "0,4": 6,
      "2,2": 7,
    },
    totalCells: 25,
  },
  {
    levelNumber: 4,
    size: 6,
    title: "Nível 4 - Grande Trânsito (6x6)",
    description: "Desafio avançado: 8 pontos de passagem sem nunca cruzar o próprio rasto.",
    waypoints: {
      "0,0": 1,
      "0,5": 2,
      "2,3": 3,
      "5,5": 4,
      "5,0": 5,
      "3,1": 6,
      "2,4": 7,
      "3,3": 8,
    },
    totalCells: 36,
  },
]

export function NumberPathGame({
  onComplete,
}: {
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [path, setPath] = useState<string[]>([]) // Array of "r,c"
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [levelScore, setLevelScore] = useState(0)

  const currentLevel = NUMBER_PATH_LEVELS[levelIdx]
  const size = currentLevel.size

  // Find start cell ("r,c" with value 1)
  const startCellKey = useMemo(() => {
    for (const [coord, val] of Object.entries(currentLevel.waypoints)) {
      if (val === 1) return coord
    }
    return "0,0"
  }, [currentLevel])

  // Total waypoints to reach
  const maxWaypoint = useMemo(() => {
    return Math.max(...Object.values(currentLevel.waypoints))
  }, [currentLevel])

  const initLevel = useCallback(() => {
    setPath([startCellKey])
    setStartTime(Date.now())
    setElapsedMs(0)
    setIsWon(false)
    setLevelScore(0)
  }, [startCellKey])

  useEffect(() => {
    initLevel()
  }, [currentLevel, initLevel])

  useEffect(() => {
    if (isWon) return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime)
    }, 200)
    return () => clearInterval(interval)
  }, [startTime, isWon])

  // Current highest reached waypoint
  const currentReachedWaypoint = useMemo(() => {
    let highest = 1
    for (const cellKey of path) {
      const wp = currentLevel.waypoints[cellKey]
      if (wp && wp === highest + 1) {
        highest = wp
      }
    }
    return highest
  }, [path, currentLevel])

  const nextNeededWaypoint = currentReachedWaypoint + 1

  const handleCellClick = (r: number, c: number) => {
    if (isWon) return
    const targetKey = `${r},${c}`

    if (path.length === 0) {
      if (targetKey === startCellKey) {
        setPath([targetKey])
        playStepSound(1)
      }
      return
    }

    const lastKey = path[path.length - 1]
    if (lastKey === targetKey) return

    // If clicking previous cell, back up
    if (path.length > 1 && path[path.length - 2] === targetKey) {
      setPath(prev => prev.slice(0, -1))
      playStepSound(path.length - 1)
      return
    }

    // Must be adjacent to last cell
    const [lr, lc] = lastKey.split(",").map(Number)
    const dist = Math.abs(r - lr) + Math.abs(c - lc)
    if (dist !== 1) {
      playErrorBuzz()
      return
    }

    // Cannot cross already visited cells
    if (path.includes(targetKey)) {
      playErrorBuzz()
      return
    }

    // If target has a waypoint, check if it's the correct next waypoint
    const targetWaypoint = currentLevel.waypoints[targetKey]
    if (targetWaypoint !== undefined) {
      if (targetWaypoint !== nextNeededWaypoint) {
        // Must visit waypoints in numerical sequence!
        playErrorBuzz()
        return
      }
    }

    const newPath = [...path, targetKey]
    setPath(newPath)
    playStepSound(newPath.length)

    // Check if reached max waypoint!
    if (targetWaypoint === maxWaypoint) {
      const timeSec = Math.max(1, Math.round(elapsedMs / 1000))
      const baseScore = currentLevel.levelNumber * 1400
      const cellsCoveredBonus = Math.round((newPath.length / currentLevel.totalCells) * 600)
      const speedBonus = Math.max(0, 1500 - timeSec * 20)
      const finalScore = baseScore + cellsCoveredBonus + speedBonus

      setLevelScore(finalScore)
      setIsWon(true)
      playSuccessChime()

      onComplete({
        gameId: "number_path",
        score: finalScore,
        level: currentLevel.levelNumber,
        timeMs: elapsedMs,
        moves: newPath.length,
        metadata: {
          pathLength: newPath.length,
          maxWaypoint,
        },
      })
    }
  }

  const handleUndo = () => {
    if (isWon || path.length <= 1) return
    setPath(prev => prev.slice(0, -1))
  }

  const pathSet = useMemo(() => new Set(path), [path])

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
            {currentLevel.title}
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Alvo: Marco #{nextNeededWaypoint <= maxWaypoint ? nextNeededWaypoint : maxWaypoint} • {path.length} Casas
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="text-right mr-2">
            <span className="text-[11px] text-[var(--text-tertiary)] block">Tempo</span>
            <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          <button
            onClick={handleUndo}
            disabled={path.length <= 1}
            title="Desfazer último passo"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={initLevel}
            title="Reiniciar nível"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div
        className="p-2.5 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md touch-none"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gap: "5px",
          width: size === 6 ? "340px" : "310px",
          height: size === 6 ? "340px" : "310px",
        }}
      >
        {Array.from({ length: size }).map((_, r) =>
          Array.from({ length: size }).map((_, c) => {
            const key = `${r},${c}`
            const wp = currentLevel.waypoints[key]
            const isVisited = pathSet.has(key)
            const isLast = path.length > 0 && path[path.length - 1] === key
            const isNextTarget = wp === nextNeededWaypoint

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleCellClick(r, c)}
                className={`relative flex items-center justify-center rounded-xl font-bold transition-all text-sm ${
                  isLast
                    ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--surface-bg)]"
                    : isVisited
                    ? "bg-amber-500/30 text-amber-700 dark:text-amber-200 border border-amber-500/40"
                    : wp !== undefined
                    ? isNextTarget
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-2 border-amber-500 animate-pulse font-extrabold"
                      : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-2 border-[var(--border-subtle)]"
                    : "bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                }`}
              >
                {wp !== undefined ? (
                  <span className={`text-base ${isVisited ? "scale-90" : "scale-100"}`}>
                    {wp}
                  </span>
                ) : isVisited ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                ) : null}
              </button>
            )
          })
        )}
      </div>

      {/* Level Selection & Legend */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {NUMBER_PATH_LEVELS.map((lvl, i) => (
            <button
              key={lvl.levelNumber}
              onClick={() => setLevelIdx(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvl.levelNumber}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[var(--text-tertiary)]">
          Ligue 1 até {maxWaypoint} sem cruzar casas
        </span>
      </div>

      {/* Win Banner */}
      {isWon && (
        <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex flex-col gap-2 items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-sm">Rota Completa com Sucesso!</span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Caminho contínuo até #{maxWaypoint}: <strong className="font-bold">+{levelScore} XP</strong> conquistados!
          </p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={initLevel}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            {levelIdx < NUMBER_PATH_LEVELS.length - 1 && (
              <button
                onClick={() => setLevelIdx(prev => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                Próximo Nível <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

