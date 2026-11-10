"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { RotateCcw, CheckCircle2, ArrowRight, Undo2, Lightbulb, Shuffle, AlertTriangle } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import {
  generateNumberPathLevel,
  findNextWaypointBfs,
  getLisbonDateKey,
  type GeneratedNumberPathLevel,
} from "../lib/puzzle-generator"
import type { GameCompletionEvent } from "../types"

const TOTAL_LEVELS = 5

export function NumberPathGame({
  dailyKey,
  onComplete,
}: {
  dailyKey?: string
  onComplete: (event: GameCompletionEvent) => void
}) {
  const effectiveDailyKey = dailyKey || getLisbonDateKey()
  const [levelIdx, setLevelIdx] = useState(0)
  const [variant, setVariant] = useState(0)
  const [resetCount, setResetCount] = useState(0)

  const currentLevel = useMemo(
    () => generateNumberPathLevel(levelIdx + 1, effectiveDailyKey, variant),
    [levelIdx, effectiveDailyKey, variant]
  )

  return (
    <NumberPathBoard
      key={`${effectiveDailyKey}-${levelIdx}-${variant}-${resetCount}`}
      level={currentLevel}
      levelIdx={levelIdx}
      variant={variant}
      onSelectLevel={idx => {
        setLevelIdx(idx)
        setVariant(0)
      }}
      onRestart={() => setResetCount(c => c + 1)}
      onNewVariant={() => setVariant(v => v + 1)}
      onNextLevel={() => {
        if (levelIdx < TOTAL_LEVELS - 1) {
          setLevelIdx(prev => prev + 1)
          setVariant(0)
        }
      }}
      onComplete={onComplete}
    />
  )
}

function NumberPathBoard({
  level,
  levelIdx,
  variant,
  onSelectLevel,
  onRestart,
  onNewVariant,
  onNextLevel,
  onComplete,
}: {
  level: GeneratedNumberPathLevel
  levelIdx: number
  variant: number
  onSelectLevel: (idx: number) => void
  onRestart: () => void
  onNewVariant: () => void
  onNextLevel: () => void
  onComplete: (event: GameCompletionEvent) => void
}) {
  const size = level.size

  const startCellKey = useMemo(() => {
    for (const [coord, val] of Object.entries(level.waypoints)) {
      if (val === 1) return coord
    }
    return "0,0"
  }, [level.waypoints])

  const maxWaypoint = useMemo(() => {
    return Math.max(...Object.values(level.waypoints))
  }, [level.waypoints])

  const [path, setPath] = useState<string[]>(() => [startCellKey])
  const [hintsUsed, setHintsUsed] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [levelScore, setLevelScore] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (isWon) return
    const startedAt = Date.now()
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 100)
    return () => clearInterval(interval)
  }, [isWon])

  const currentReachedWaypoint = useMemo(() => {
    let highest = 1
    for (const cellKey of path) {
      const wp = level.waypoints[cellKey]
      if (wp && wp === highest + 1) {
        highest = wp
      }
    }
    return highest
  }, [path, level.waypoints])

  const nextNeededWaypoint = currentReachedWaypoint + 1

  const nextBfsSteps = useMemo(() => {
    if (isWon || nextNeededWaypoint > maxWaypoint) return []
    return findNextWaypointBfs(size, path, level.waypoints, nextNeededWaypoint, maxWaypoint)
  }, [isWon, level.waypoints, maxWaypoint, nextNeededWaypoint, path, size])

  const isBlocked = !isWon && nextNeededWaypoint <= maxWaypoint && nextBfsSteps === null

  const stepToCell = useCallback(
    (r: number, c: number, suppressErrorBuzz = false, nextHintsCount?: number) => {
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

      // Back up if moving onto previous cell
      if (path.length > 1 && path[path.length - 2] === targetKey) {
        setPath(prev => prev.slice(0, -1))
        playStepSound(path.length - 1)
        return
      }

      // Must be orthogonal neighbor
      const [lr, lc] = lastKey.split(",").map(Number)
      if (Math.abs(r - lr) + Math.abs(c - lc) !== 1) {
        if (!suppressErrorBuzz) playErrorBuzz()
        return
      }

      // Cannot cross already visited cells
      if (path.includes(targetKey)) {
        if (!suppressErrorBuzz) playErrorBuzz()
        return
      }

      const targetWaypoint = level.waypoints[targetKey]
      if (targetWaypoint !== undefined && targetWaypoint !== nextNeededWaypoint) {
        if (!suppressErrorBuzz) playErrorBuzz()
        return
      }

      const newPath = [...path, targetKey]
      setPath(newPath)
      playStepSound(newPath.length)

      if (targetWaypoint === maxWaypoint) {
        setIsDragging(false)
        const finalElapsed = elapsedMs
        const timeSec = Math.max(1, Math.round(finalElapsed / 1000))
        const usedHints = nextHintsCount ?? hintsUsed
        const baseScore = level.levelNumber * 1400
        const cellsCoveredBonus = Math.round((newPath.length / level.totalCells) * 600)
        const speedBonus = Math.max(0, 1500 - timeSec * 20)
        const finalScore = Math.max(250, baseScore + cellsCoveredBonus + speedBonus - usedHints * 180)

        setLevelScore(finalScore)
        setIsWon(true)
        playSuccessChime()

        onComplete({
          gameId: "number_path",
          score: finalScore,
          level: level.levelNumber,
          timeMs: finalElapsed,
          moves: newPath.length,
          metadata: {
            pathLength: newPath.length,
            maxWaypoint,
            hintsUsed: usedHints,
          },
        })
      }
    },
    [elapsedMs, hintsUsed, isWon, level.levelNumber, level.totalCells, level.waypoints, maxWaypoint, nextNeededWaypoint, onComplete, path, startCellKey]
  )

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isWon) return
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
      setIsDragging(false)
      return
    }
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const cellEl = target?.closest("[data-zip-cell]") as HTMLElement | null
    if (!cellEl) return
    const raw = cellEl.dataset.zipCell
    if (!raw) return
    const [r, c] = raw.split(",").map(Number)
    stepToCell(r, c, true)
  }

  const handleUndo = () => {
    if (isWon || path.length <= 1) return
    setPath(prev => prev.slice(0, -1))
  }

  const handleHint = () => {
    if (isWon || nextNeededWaypoint > maxWaypoint) return
    const nextHints = hintsUsed + 1
    setHintsUsed(nextHints)

    if (nextBfsSteps && nextBfsSteps.length > 0) {
      const [nr, nc] = nextBfsSteps[0].split(",").map(Number)
      stepToCell(nr, nc, true, nextHints)
      return
    }

    // Current branch blocked nextNeededWaypoint: walk back along solutionPath prefix if valid
    let matchPrefixLen = 1
    for (let i = 1; i < Math.min(path.length, level.solutionPath.length); i++) {
      if (path[i] === level.solutionPath[i]) {
        matchPrefixLen = i + 1
      } else {
        break
      }
    }
    const nextSolStep = level.solutionPath[matchPrefixLen]
    if (nextSolStep) {
      setPath([...level.solutionPath.slice(0, matchPrefixLen), nextSolStep])
      playStepSound(matchPrefixLen + 1)
    }
  }

  const pathSet = useMemo(() => new Set(path), [path])

  const svgPoints = useMemo(() => {
    return path
      .map(k => {
        const [r, c] = k.split(",").map(Number)
        const x = ((c + 0.5) / size) * 100
        const y = ((r + 0.5) / size) * 100
        return `${x},${y}`
      })
      .join(" ")
  }, [path, size])

  const boardSizePx = size === 6 ? 340 : 310

  return (
    <div
      className="flex flex-col items-center select-none"
      onPointerUp={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
    >
      {/* Top Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
              {level.title}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase">
              {variant === 0 ? "Diário" : `Aleatório #${variant}`}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Alvo: Marco #{Math.min(nextNeededWaypoint, maxWaypoint)}/{maxWaypoint} • {path.length}/{level.totalCells} Casas
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="text-right mr-1.5">
            <span className="text-[11px] text-[var(--text-tertiary)] block">Tempo</span>
            <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          <button
            onClick={handleHint}
            disabled={isWon}
            title="Avançar próximo passo válido (Dica)"
            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            onClick={handleUndo}
            disabled={path.length <= 1 || isWon}
            title="Desfazer último passo"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={onNewVariant}
            title="Gerar novo tabuleiro aleatório"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onRestart}
            title="Reiniciar nível"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blocked Warning Banner */}
      {isBlocked && (
        <div className="w-full max-w-md mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Sem passagem até ao Marco #{nextNeededWaypoint}. Recue ou peça Dica.
          </span>
          <button
            onClick={handleUndo}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 font-bold text-[11px] shrink-0"
          >
            Desfazer
          </button>
        </div>
      )}

      {/* Grid Canvas with SVG route line overlay */}
      <div
        onPointerMove={handleBoardPointerMove}
        className="relative p-2.5 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md touch-none"
        style={{
          width: `${boardSizePx}px`,
          height: `${boardSizePx}px`,
        }}
      >
        {/* Continuous route line behind waypoint numbers */}
        {path.length > 1 && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-2.5 w-[calc(100%-20px)] h-[calc(100%-20px)] pointer-events-none z-10"
          >
            <polyline
              fill="none"
              stroke="rgba(245, 158, 11, 0.55)"
              strokeWidth={size >= 6 ? 4.2 : 5}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />
          </svg>
        )}

        <div
          className="relative z-20 w-full h-full"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gap: "5px",
          }}
        >
          {Array.from({ length: size }).map((_, r) =>
            Array.from({ length: size }).map((_, c) => {
              const key = `${r},${c}`
              const wp = level.waypoints[key]
              const isVisited = pathSet.has(key)
              const isLast = path.length > 0 && path[path.length - 1] === key
              const isNextTarget = wp === nextNeededWaypoint

              return (
                <button
                  key={key}
                  type="button"
                  data-zip-cell={key}
                  onPointerDown={e => {
                    e.preventDefault()
                    setIsDragging(true)
                    stepToCell(r, c)
                  }}
                  onPointerEnter={() => {
                    if (isDragging) stepToCell(r, c, true)
                  }}
                  className={`relative flex items-center justify-center rounded-xl font-bold transition-colors text-sm ${
                    isLast
                      ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--surface-bg)]"
                      : isVisited
                      ? "bg-amber-500/25 text-amber-700 dark:text-amber-200 border border-amber-500/40"
                      : wp !== undefined
                      ? isNextTarget
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-2 border-amber-500 animate-pulse font-extrabold"
                        : "bg-[var(--surface-muted)] text-[var(--text-primary)] border-2 border-[var(--border-subtle)]"
                      : "bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {wp !== undefined ? (
                    <span className={`text-base ${isVisited ? "scale-95" : "scale-100"}`}>
                      {wp}
                    </span>
                  ) : isVisited ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Level Selection & Legend */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((lvlNum, i) => (
            <button
              key={lvlNum}
              onClick={() => onSelectLevel(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvlNum}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[var(--text-tertiary)]">
          Clique ou arraste de 1 até {maxWaypoint}
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
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <button
              onClick={onRestart}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            <button
              onClick={onNewVariant}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1"
            >
              <Shuffle className="w-3 h-3" /> Novo Tabuleiro
            </button>
            {levelIdx < TOTAL_LEVELS - 1 && (
              <button
                onClick={onNextLevel}
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
