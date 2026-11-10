"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { RotateCcw, CheckCircle2, ArrowRight, Undo2, Lightbulb, Shuffle, AlertTriangle } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import {
  generateOneStrokeLevel,
  evaluateOneStrokeRemainingState,
  getEdgeKey,
  getLisbonDateKey,
  type GeneratedOneStrokeLevel,
} from "../lib/puzzle-generator"
import type { GameCompletionEvent } from "../types"

const TOTAL_LEVELS = 5

export function OneStrokeGame({
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
    () => generateOneStrokeLevel(levelIdx + 1, effectiveDailyKey, variant),
    [levelIdx, effectiveDailyKey, variant]
  )

  return (
    <OneStrokeBoard
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

function OneStrokeBoard({
  level,
  levelIdx,
  variant,
  onSelectLevel,
  onRestart,
  onNewVariant,
  onNextLevel,
  onComplete,
}: {
  level: GeneratedOneStrokeLevel
  levelIdx: number
  variant: number
  onSelectLevel: (idx: number) => void
  onRestart: () => void
  onNewVariant: () => void
  onNextLevel: () => void
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [visitedPath, setVisitedPath] = useState<number[]>([])
  const [hintsUsed, setHintsUsed] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [levelScore, setLevelScore] = useState(0)

  const svgRef = useRef<SVGSVGElement>(null)
  const isDraggingRef = useRef(false)
  const elapsedRef = useRef(0)

  const totalEdges = level.edges.length

  useEffect(() => {
    if (isWon) return
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const next = Date.now() - startedAt
      elapsedRef.current = next
      setElapsedMs(next)
    }, 150)
    return () => clearInterval(interval)
  }, [isWon])

  const traversedEdgeKeys = useMemo(() => {
    const keys = new Set<string>()
    for (let i = 0; i < visitedPath.length - 1; i++) {
      keys.add(getEdgeKey(visitedPath[i], visitedPath[i + 1]))
    }
    return keys
  }, [visitedPath])

  const hasEdge = useCallback(
    (u: number, v: number): boolean => {
      const key = getEdgeKey(u, v)
      return level.edges.some(e => getEdgeKey(e.u, e.v) === key)
    },
    [level.edges]
  )

  const currentVertexId = visitedPath.length > 0 ? visitedPath[visitedPath.length - 1] : null

  const remainingState = useMemo(() => {
    if (isWon) return { canFinish: true, nextHintVertexId: null, oddRemainingVertices: [] }
    return evaluateOneStrokeRemainingState(level.edges, traversedEdgeKeys, currentVertexId)
  }, [isWon, level.edges, traversedEdgeKeys, currentVertexId])

  const oddStartSet = useMemo(() => new Set(level.oddVertexIds), [level.oddVertexIds])

  const stepToVertex = useCallback(
    (vertexId: number, suppressErrorSound = false, nextHintsCount?: number) => {
      if (isWon) return

      if (visitedPath.length === 0) {
        setVisitedPath([vertexId])
        playStepSound(0)
        return
      }

      const curVertex = visitedPath[visitedPath.length - 1]
      if (curVertex === vertexId) return

      // Allow smooth backtracking to previous vertex when dragging/clicking back
      if (visitedPath.length >= 2 && visitedPath[visitedPath.length - 2] === vertexId) {
        setVisitedPath(prev => prev.slice(0, -1))
        playStepSound(visitedPath.length - 2)
        return
      }

      if (!hasEdge(curVertex, vertexId)) {
        if (!suppressErrorSound) playErrorBuzz()
        return
      }

      const edgeKey = getEdgeKey(curVertex, vertexId)
      if (traversedEdgeKeys.has(edgeKey)) {
        if (!suppressErrorSound) playErrorBuzz()
        return
      }

      const newPath = [...visitedPath, vertexId]
      const newTraversedKeys = new Set(traversedEdgeKeys)
      newTraversedKeys.add(edgeKey)

      setVisitedPath(newPath)
      playStepSound(newPath.length)

      if (newTraversedKeys.size === totalEdges) {
        isDraggingRef.current = false
        const finalElapsed = elapsedRef.current
        const timeSec = Math.max(1, Math.round(finalElapsed / 1000))
        const usedHints = nextHintsCount ?? hintsUsed
        const baseScore = level.levelNumber * 1500
        const speedBonus = Math.max(0, 1500 - timeSec * 20)
        const finalScore = Math.max(250, baseScore + speedBonus - usedHints * 180)

        setElapsedMs(finalElapsed)
        setLevelScore(finalScore)
        setIsWon(true)
        playSuccessChime()

        onComplete({
          gameId: "one_stroke",
          score: finalScore,
          level: level.levelNumber,
          timeMs: finalElapsed,
          moves: newPath.length - 1,
          metadata: {
            hintsUsed: usedHints,
          },
        })
      }
    },
    [hasEdge, hintsUsed, isWon, level.levelNumber, onComplete, totalEdges, traversedEdgeKeys, visitedPath]
  )

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || isWon || !svgRef.current) return
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
      isDraggingRef.current = false
      return
    }
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const svgX = ((e.clientX - rect.left) / rect.width) * 300
    const svgY = ((e.clientY - rect.top) / rect.height) * 300

    for (const v of level.vertices) {
      if (v.id === currentVertexId) continue
      const d = Math.hypot(svgX - v.x, svgY - v.y)
      if (d <= 20) {
        // Only snap automatically when valid edge move (or backtrack)
        if (
          currentVertexId !== null &&
          ((visitedPath.length >= 2 && visitedPath[visitedPath.length - 2] === v.id) ||
            (hasEdge(currentVertexId, v.id) && !traversedEdgeKeys.has(getEdgeKey(currentVertexId, v.id))))
        ) {
          stepToVertex(v.id, true)
        }
        break
      }
    }
  }

  const handleUndo = () => {
    if (isWon || visitedPath.length === 0) return
    if (visitedPath.length === 1) {
      setVisitedPath([])
      return
    }
    setVisitedPath(prev => prev.slice(0, -1))
  }

  const handleHint = () => {
    if (isWon) return
    const nextHints = hintsUsed + 1
    setHintsUsed(nextHints)

    if (visitedPath.length === 0) {
      const startVertex = level.solutionPath[0]
      if (startVertex !== undefined) {
        setVisitedPath([startVertex])
        playStepSound(0)
      }
      return
    }

    if (remainingState.canFinish && remainingState.nextHintVertexId !== null) {
      stepToVertex(remainingState.nextHintVertexId, true, nextHints)
      return
    }

    // Backtrack to the deepest still-finishable prefix and step forward
    for (let cut = visitedPath.length - 1; cut >= 1; cut--) {
      const prefix = visitedPath.slice(0, cut)
      const prefixKeys = new Set<string>()
      for (let i = 0; i < prefix.length - 1; i++) {
        prefixKeys.add(getEdgeKey(prefix[i], prefix[i + 1]))
      }
      const evalPrefix = evaluateOneStrokeRemainingState(
        level.edges,
        prefixKeys,
        prefix[prefix.length - 1]
      )
      if (evalPrefix.canFinish && evalPrefix.nextHintVertexId !== null) {
        setVisitedPath([...prefix, evalPrefix.nextHintVertexId])
        playStepSound(prefix.length)
        return
      }
    }

    // Worst case if started at non-odd vertex: restart directly from true solution start
    if (level.solutionPath.length >= 2) {
      setVisitedPath([level.solutionPath[0], level.solutionPath[1]])
      playStepSound(1)
    }
  }

  const isStuck = !isWon && visitedPath.length > 0 && !remainingState.canFinish

  return (
    <div
      className="flex flex-col items-center select-none"
      onPointerUp={() => {
        isDraggingRef.current = false
      }}
      onPointerCancel={() => {
        isDraggingRef.current = false
      }}
    >
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
              {level.title}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase">
              {variant === 0 ? "Diário" : `Aleatório #${variant}`}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {traversedEdgeKeys.size}/{totalEdges} Arestas Percorridas
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
            title="Avançar 1 passo válido (Dica)"
            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            onClick={handleUndo}
            disabled={visitedPath.length === 0 || isWon}
            title="Desfazer último traço"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={onNewVariant}
            title="Gerar nova figura aleatória"
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

      {/* Helpful Euler Rule Status */}
      {isStuck ? (
        <div className="w-full max-w-md mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Caminho sem saída possível a partir daqui.
          </span>
          <button
            onClick={handleUndo}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 font-bold text-[11px] shrink-0"
          >
            Desfazer
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md mb-3 px-3 py-1.5 rounded-lg bg-[var(--surface-muted)]/60 text-[11px] text-[var(--text-secondary)] text-center">
          {level.description}
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative p-2 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          onPointerMove={handleSvgPointerMove}
          className="w-[310px] h-[310px] sm:w-[340px] sm:h-[340px] touch-none"
        >
          {/* Base edges (Untraversed) */}
          {level.edges.map((e, idx) => {
            const u = level.vertices.find(v => v.id === e.u)!
            const v = level.vertices.find(item => item.id === e.v)!
            const key = getEdgeKey(e.u, e.v)
            const isTraversed = traversedEdgeKeys.has(key)

            return (
              <line
                key={`base-${idx}`}
                x1={u.x}
                y1={u.y}
                x2={v.x}
                y2={v.y}
                stroke="currentColor"
                strokeWidth={isTraversed ? 5 : 3.5}
                strokeLinecap="round"
                className={`transition-all ${
                  isTraversed
                    ? "text-blue-500 stroke-blue-500"
                    : "text-zinc-300 dark:text-zinc-700 stroke-zinc-300 dark:stroke-zinc-700"
                }`}
              />
            )
          })}

          {/* Glowing Traversed Path */}
          {visitedPath.length > 1 &&
            visitedPath.slice(0, -1).map((vId, idx) => {
              const nextVId = visitedPath[idx + 1]
              const u = level.vertices.find(v => v.id === vId)!
              const v = level.vertices.find(item => item.id === nextVId)!

              return (
                <line
                  key={`glow-${idx}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#3b82f6"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
              )
            })}

          {/* Vertices */}
          {level.vertices.map(vertex => {
            const isCurrent = currentVertexId === vertex.id
            const isSuggestedStart = visitedPath.length === 0 && oddStartSet.has(vertex.id)
            const isAvailableTarget =
              currentVertexId !== null &&
              hasEdge(currentVertexId, vertex.id) &&
              !traversedEdgeKeys.has(getEdgeKey(currentVertexId, vertex.id))

            return (
              <g
                key={vertex.id}
                onPointerDown={e => {
                  e.preventDefault()
                  isDraggingRef.current = true
                  stepToVertex(vertex.id)
                }}
                className="cursor-pointer group"
              >
                <circle cx={vertex.x} cy={vertex.y} r="22" fill="transparent" />

                {isSuggestedStart && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="15"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                )}

                {isCurrent && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="16"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    className="animate-ping opacity-60"
                  />
                )}

                {isAvailableTarget && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="13"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                )}

                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r={isCurrent ? 11 : isSuggestedStart ? 10 : 9}
                  className={`transition-all ${
                    isCurrent
                      ? "fill-blue-600 stroke-white stroke-2 shadow-lg"
                      : isAvailableTarget
                      ? "fill-emerald-500 stroke-white stroke-2"
                      : isSuggestedStart
                      ? "fill-amber-500 stroke-white stroke-2"
                      : "fill-zinc-400 dark:fill-zinc-500 group-hover:fill-zinc-600 stroke-[var(--surface-bg)] stroke-2"
                  }`}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Level Selection & Instructions */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((lvlNum, i) => (
            <button
              key={lvlNum}
              onClick={() => onSelectLevel(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvlNum}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[var(--text-tertiary)]">
          Clique ou arraste entre os pontos
        </span>
      </div>

      {/* Win Banner */}
      {isWon && (
        <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 flex flex-col gap-2 items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <span className="font-bold text-sm">Figura Traçada com Sucesso!</span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Traço contínuo perfeito: <strong className="font-bold">+{levelScore} XP</strong> adicionados ao Ranking!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <button
              onClick={onRestart}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            <button
              onClick={onNewVariant}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1"
            >
              <Shuffle className="w-3 h-3" /> Nova Figura
            </button>
            {levelIdx < TOTAL_LEVELS - 1 && (
              <button
                onClick={onNextLevel}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
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
