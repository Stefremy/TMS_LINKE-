"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { RotateCcw, CheckCircle2, ArrowRight, Undo2, Award } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import type { GameCompletionEvent } from "../types"

interface Vertex {
  id: number
  x: number
  y: number
}

interface Edge {
  u: number
  v: number
}

interface OneStrokeLevel {
  levelNumber: number
  title: string
  description: string
  vertices: Vertex[]
  edges: Edge[]
}

const ONE_STROKE_LEVELS: OneStrokeLevel[] = [
  {
    levelNumber: 1,
    title: "Nível 1 - A Casa Tradicional",
    description: "Inicie num dos cantos inferiores para percorrer as 8 arestas.",
    vertices: [
      { id: 0, x: 150, y: 40 },  // Topo do telhado
      { id: 1, x: 60, y: 120 },  // Telhado esquerdo
      { id: 2, x: 240, y: 120 }, // Telhado direito
      { id: 3, x: 60, y: 240 },  // Base esquerda
      { id: 4, x: 240, y: 240 }, // Base direita
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 2 },
      { u: 1, v: 2 },
      { u: 1, v: 3 },
      { u: 2, v: 4 },
      { u: 3, v: 4 },
      { u: 1, v: 4 }, // Diagonal 1
      { u: 2, v: 3 }, // Diagonal 2
    ],
  },
  {
    levelNumber: 2,
    title: "Nível 2 - A Estrela Pentagonal",
    description: "Todas as pontas têm 4 caminhos; pode começar em qualquer vértice!",
    vertices: [
      { id: 0, x: 150, y: 35 },
      { id: 1, x: 255, y: 110 },
      { id: 2, x: 215, y: 235 },
      { id: 3, x: 85, y: 235 },
      { id: 4, x: 45, y: 110 },
    ],
    edges: [
      // Outer ring
      { u: 0, v: 1 },
      { u: 1, v: 2 },
      { u: 2, v: 3 },
      { u: 3, v: 4 },
      { u: 4, v: 0 },
      // Inner star chords
      { u: 0, v: 2 },
      { u: 2, v: 4 },
      { u: 4, v: 1 },
      { u: 1, v: 3 },
      { u: 3, v: 0 },
    ],
  },
  {
    levelNumber: 3,
    title: "Nível 3 - Ampulheta com Travessa",
    description: "6 vértices interligados em triângulos espelhados.",
    vertices: [
      { id: 0, x: 80, y: 50 },
      { id: 1, x: 220, y: 50 },
      { id: 2, x: 150, y: 140 }, // Centro
      { id: 3, x: 80, y: 230 },
      { id: 4, x: 220, y: 230 },
      { id: 5, x: 150, y: 230 }, // Base central
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 1, v: 2 },
      { u: 2, v: 0 },
      { u: 2, v: 3 },
      { u: 3, v: 5 },
      { u: 5, v: 4 },
      { u: 4, v: 2 },
      { u: 0, v: 3 },
      { u: 1, v: 4 },
      { u: 2, v: 5 },
    ],
  },
  {
    levelNumber: 4,
    title: "Nível 4 - O Diamante Geminado",
    description: "Geometria facetada com múltiplos nós de passagem obrigatória.",
    vertices: [
      { id: 0, x: 150, y: 30 },  // Topo
      { id: 1, x: 50, y: 110 },  // Esquerda
      { id: 2, x: 150, y: 110 }, // Centro
      { id: 3, x: 250, y: 110 }, // Direita
      { id: 4, x: 90, y: 220 },  // Fundo esquerdo
      { id: 5, x: 210, y: 220 }, // Fundo direito
      { id: 6, x: 150, y: 260 }, // Ponta inferior
    ],
    edges: [
      { u: 0, v: 1 },
      { u: 0, v: 2 },
      { u: 0, v: 3 },
      { u: 1, v: 2 },
      { u: 2, v: 3 },
      { u: 1, v: 4 },
      { u: 3, v: 5 },
      { u: 4, v: 6 },
      { u: 5, v: 6 },
      { u: 2, v: 4 },
      { u: 2, v: 5 },
      { u: 4, v: 5 },
    ],
  },
]

function getEdgeKey(u: number, v: number): string {
  return u < v ? `${u}-${v}` : `${v}-${u}`
}

export function OneStrokeGame({
  onComplete,
}: {
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [visitedPath, setVisitedPath] = useState<number[]>([]) // Array of vertex IDs visited
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [levelScore, setLevelScore] = useState(0)

  const currentLevel = ONE_STROKE_LEVELS[levelIdx]

  // Track traversed edge keys
  const traversedEdgeKeys = useMemo(() => {
    const keys = new Set<string>()
    for (let i = 0; i < visitedPath.length - 1; i++) {
      keys.add(getEdgeKey(visitedPath[i], visitedPath[i + 1]))
    }
    return keys
  }, [visitedPath])

  // Total edges in current level
  const totalEdges = currentLevel.edges.length

  const initLevel = useCallback(() => {
    setVisitedPath([])
    setStartTime(Date.now())
    setElapsedMs(0)
    setIsWon(false)
    setLevelScore(0)
  }, [])

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

  // Check if edge exists in level graph
  const hasEdge = useCallback((u: number, v: number): boolean => {
    const key = getEdgeKey(u, v)
    return currentLevel.edges.some(e => getEdgeKey(e.u, e.v) === key)
  }, [currentLevel])

  const handleVertexClick = (vertexId: number) => {
    if (isWon) return

    // If starting
    if (visitedPath.length === 0) {
      setVisitedPath([vertexId])
      playStepSound(0)
      return
    }

    const currentVertex = visitedPath[visitedPath.length - 1]
    if (currentVertex === vertexId) return

    // Check if connected by an edge
    if (!hasEdge(currentVertex, vertexId)) {
      playErrorBuzz()
      return
    }

    // Check if edge already traversed
    const edgeKey = getEdgeKey(currentVertex, vertexId)
    if (traversedEdgeKeys.has(edgeKey)) {
      playErrorBuzz()
      return
    }

    // Valid move!
    const newPath = [...visitedPath, vertexId]
    setVisitedPath(newPath)
    playStepSound(newPath.length)

    // Check if all edges traversed
    const newTraversedKeys = new Set(traversedEdgeKeys)
    newTraversedKeys.add(edgeKey)

    if (newTraversedKeys.size === totalEdges) {
      // Victory!
      const timeSec = Math.max(1, Math.round(elapsedMs / 1000))
      const baseScore = currentLevel.levelNumber * 1500
      const speedBonus = Math.max(0, 1500 - timeSec * 20)
      const finalScore = baseScore + speedBonus

      setLevelScore(finalScore)
      setIsWon(true)
      playSuccessChime()

      onComplete({
        gameId: "one_stroke",
        score: finalScore,
        level: currentLevel.levelNumber,
        timeMs: elapsedMs,
        moves: newPath.length - 1,
      })
    }
  }

  const handleUndo = () => {
    if (isWon || visitedPath.length <= 1) {
      setVisitedPath([])
      return
    }
    setVisitedPath(prev => prev.slice(0, -1))
  }

  const currentVertexId = visitedPath.length > 0 ? visitedPath[visitedPath.length - 1] : null

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
            {currentLevel.title}
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {traversedEdgeKeys.size}/{totalEdges} Arestas Percorridas
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
            disabled={visitedPath.length === 0}
            title="Desfazer último traço"
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

      {/* SVG Canvas */}
      <div className="relative p-2 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md flex items-center justify-center">
        <svg
          viewBox="0 0 300 300"
          className="w-[310px] h-[310px] sm:w-[340px] sm:h-[340px] touch-none"
        >
          {/* Base edges (Untraversed) */}
          {currentLevel.edges.map((e, idx) => {
            const u = currentLevel.vertices.find(v => v.id === e.u)!
            const v = currentLevel.vertices.find(v => v.id === e.v)!
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

          {/* Glowing Animated Traversed Path */}
          {visitedPath.length > 1 &&
            visitedPath.slice(0, -1).map((vId, idx) => {
              const nextVId = visitedPath[idx + 1]
              const u = currentLevel.vertices.find(v => v.id === vId)!
              const v = currentLevel.vertices.find(v => v.id === nextVId)!

              return (
                <line
                  key={`glow-${idx}`}
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#3b82f6"
                  strokeWidth="5"
                  strokeLinecap="round"
                  className="animate-in fade-in duration-150"
                />
              )
            })}

          {/* Vertices */}
          {currentLevel.vertices.map(vertex => {
            const isCurrent = currentVertexId === vertex.id
            const isAvailableTarget =
              currentVertexId !== null &&
              hasEdge(currentVertexId, vertex.id) &&
              !traversedEdgeKeys.has(getEdgeKey(currentVertexId, vertex.id))

            return (
              <g
                key={vertex.id}
                onClick={() => handleVertexClick(vertex.id)}
                className="cursor-pointer group"
              >
                {/* Hit area */}
                <circle cx={vertex.x} cy={vertex.y} r="22" fill="transparent" />

                {/* Pulse ring for current vertex */}
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

                {/* Pulse for valid targets */}
                {isAvailableTarget && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="12"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    className="animate-spin"
                  />
                )}

                {/* Node body */}
                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r={isCurrent ? 11 : 9}
                  className={`transition-all ${
                    isCurrent
                      ? "fill-blue-600 stroke-white stroke-2 shadow-lg"
                      : isAvailableTarget
                      ? "fill-emerald-500 group-hover:scale-125 stroke-white stroke-2"
                      : "fill-zinc-400 dark:fill-zinc-500 group-hover:fill-zinc-600 stroke-[var(--surface-bg)] stroke-2"
                  }`}
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Instructions & Level Selection */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {ONE_STROKE_LEVELS.map((lvl, i) => (
            <button
              key={lvl.levelNumber}
              onClick={() => setLevelIdx(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvl.levelNumber}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[var(--text-tertiary)]">
          {visitedPath.length === 0
            ? "Clique num ponto para começar"
            : "Ligue os pontos sem repetir caminhos"}
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
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={initLevel}
              className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            {levelIdx < ONE_STROKE_LEVELS.length - 1 && (
              <button
                onClick={() => setLevelIdx(prev => prev + 1)}
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

