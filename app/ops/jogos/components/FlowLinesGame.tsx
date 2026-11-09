"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Play, RotateCcw, Award, CheckCircle2, Volume2, VolumeX, ArrowRight } from "lucide-react"
import { playConnectSound, playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import type { GameCompletionEvent } from "../types"

interface PairColor {
  id: number
  name: string
  color: string
  bgDot: string
  bgLine: string
  border: string
}

const COLORS: PairColor[] = [
  { id: 1, name: "Vermelho", color: "#ef4444", bgDot: "bg-red-500", bgLine: "bg-red-500/80", border: "border-red-400" },
  { id: 2, name: "Azul", color: "#3b82f6", bgDot: "bg-blue-500", bgLine: "bg-blue-500/80", border: "border-blue-400" },
  { id: 3, name: "Verde", color: "#10b981", bgDot: "bg-emerald-500", bgLine: "bg-emerald-500/80", border: "border-emerald-400" },
  { id: 4, name: "Amarelo", color: "#f59e0b", bgDot: "bg-amber-500", bgLine: "bg-amber-500/80", border: "border-amber-400" },
  { id: 5, name: "Roxo", color: "#8b5cf6", bgDot: "bg-purple-500", bgLine: "bg-purple-500/80", border: "border-purple-400" },
  { id: 6, name: "Ciano", color: "#06b6d4", bgDot: "bg-cyan-500", bgLine: "bg-cyan-500/80", border: "border-cyan-400" },
]

interface LevelDef {
  levelNumber: number
  size: number
  title: string
  endpoints: { [colorId: number]: [ [number, number], [number, number] ] }
}

const FLOW_LEVELS: LevelDef[] = [
  {
    levelNumber: 1,
    size: 5,
    title: "Nível 1 - Inicial (5x5)",
    endpoints: {
      1: [[0, 0], [4, 1]], // Red
      2: [[0, 1], [3, 2]], // Blue
      3: [[0, 4], [4, 4]], // Green
      4: [[2, 3], [4, 2]], // Yellow
    },
  },
  {
    levelNumber: 2,
    size: 5,
    title: "Nível 2 - Fluxos Cruzados (5x5)",
    endpoints: {
      1: [[0, 0], [4, 4]], // Red
      2: [[0, 4], [4, 0]], // Blue
      3: [[1, 2], [3, 2]], // Green
      4: [[0, 2], [4, 2]], // Yellow
    },
  },
  {
    levelNumber: 3,
    size: 6,
    title: "Nível 3 - Expansão (6x6)",
    endpoints: {
      1: [[0, 0], [5, 0]], // Red
      2: [[0, 1], [4, 2]], // Blue
      3: [[0, 5], [5, 5]], // Green
      4: [[1, 3], [5, 2]], // Yellow
      5: [[1, 5], [4, 4]], // Purple
    },
  },
  {
    levelNumber: 4,
    size: 6,
    title: "Nível 4 - Labirinto Central (6x6)",
    endpoints: {
      1: [[0, 0], [3, 3]], // Red
      2: [[0, 3], [5, 1]], // Blue
      3: [[0, 5], [5, 4]], // Green
      4: [[2, 1], [5, 0]], // Yellow
      5: [[1, 4], [4, 5]], // Purple
    },
  },
  {
    levelNumber: 5,
    size: 7,
    title: "Nível 5 - Mestre das Linhas (7x7)",
    endpoints: {
      1: [[0, 0], [6, 1]], // Red
      2: [[0, 2], [6, 3]], // Blue
      3: [[0, 6], [6, 6]], // Green
      4: [[2, 4], [5, 5]], // Yellow
      5: [[1, 1], [5, 2]], // Purple
      6: [[3, 1], [4, 4]], // Cyan
    },
  },
]

export function FlowLinesGame({
  onComplete,
}: {
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [activeColorId, setActiveColorId] = useState<number | null>(null)
  const [paths, setPaths] = useState<{ [colorId: number]: [number, number][] }>({})
  const [connectedColors, setConnectedColors] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [muted, setMuted] = useState(false)
  const [levelScore, setLevelScore] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)

  const currentLevel = FLOW_LEVELS[levelIdx]
  const size = currentLevel.size

  // Reset or start level
  const initLevel = useCallback((lvl: LevelDef) => {
    setActiveColorId(null)
    setPaths({})
    setConnectedColors([])
    setMoves(0)
    setStartTime(Date.now())
    setElapsedMs(0)
    setIsWon(false)
    setLevelScore(0)
  }, [])

  useEffect(() => {
    initLevel(currentLevel)
  }, [currentLevel, initLevel])

  // Timer
  useEffect(() => {
    if (isWon) return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime)
    }, 200)
    return () => clearInterval(interval)
  }, [startTime, isWon])

  const isEndpoint = useCallback((r: number, c: number, colorId: number): boolean => {
    const pair = currentLevel.endpoints[colorId]
    if (!pair) return false
    return (pair[0][0] === r && pair[0][1] === c) || (pair[1][0] === r && pair[1][1] === c)
  }, [currentLevel])

  const getEndpointAt = useCallback((r: number, c: number): number | null => {
    for (const [cIdStr, pair] of Object.entries(currentLevel.endpoints)) {
      const cId = Number(cIdStr)
      if ((pair[0][0] === r && pair[0][1] === c) || (pair[1][0] === r && pair[1][1] === c)) {
        return cId
      }
    }
    return null
  }, [currentLevel])

  // Check if cell is occupied by any path
  const getCellOccupant = useCallback((r: number, c: number): { colorId: number; idx: number } | null => {
    for (const [cIdStr, p] of Object.entries(paths)) {
      const cId = Number(cIdStr)
      const idx = p.findIndex(([pr, pc]) => pr === r && pc === c)
      if (idx !== -1) {
        return { colorId: cId, idx }
      }
    }
    return null
  }, [paths])

  // Dragging logic
  const handleCellDown = (r: number, c: number) => {
    if (isWon) return
    const epColor = getEndpointAt(r, c)
    const occupant = getCellOccupant(r, c)

    let targetColor: number | null = null

    if (epColor) {
      targetColor = epColor
      // Start or restart from this endpoint
      setPaths(prev => ({
        ...prev,
        [epColor]: [[r, c]],
      }))
      setConnectedColors(prev => prev.filter(id => id !== epColor))
      setActiveColorId(epColor)
      setMoves(m => m + 1)
      playStepSound(epColor)
    } else if (occupant) {
      targetColor = occupant.colorId
      // Trim path to this cell
      setPaths(prev => ({
        ...prev,
        [occupant.colorId]: prev[occupant.colorId].slice(0, occupant.idx + 1),
      }))
      setConnectedColors(prev => prev.filter(id => id !== occupant.colorId))
      setActiveColorId(occupant.colorId)
      playStepSound(occupant.colorId)
    }
  }

  const handleCellEnter = (r: number, c: number) => {
    if (isWon || activeColorId === null) return

    const currentPath = paths[activeColorId] || []
    if (currentPath.length === 0) return

    const [lastR, lastC] = currentPath[currentPath.length - 1]

    // Only allow orthogonal adjacency
    const dist = Math.abs(r - lastR) + Math.abs(c - lastC)
    if (dist !== 1) return

    // If back-tracking to previous cell in the same path
    if (currentPath.length > 1) {
      const [prevR, prevC] = currentPath[currentPath.length - 2]
      if (prevR === r && prevC === c) {
        setPaths(prev => ({
          ...prev,
          [activeColorId]: prev[activeColorId].slice(0, -1),
        }))
        return
      }
    }

    // Check if cell is an endpoint
    const epColor = getEndpointAt(r, c)
    if (epColor !== null && epColor !== activeColorId) {
      // Cannot cross another color's endpoint
      return
    }

    // If entering another color's path, cut their path
    const occupant = getCellOccupant(r, c)
    if (occupant && occupant.colorId !== activeColorId) {
      setPaths(prev => ({
        ...prev,
        [occupant.colorId]: prev[occupant.colorId].slice(0, occupant.idx),
      }))
      setConnectedColors(prev => prev.filter(id => id !== occupant.colorId))
    }

    // If already in this path earlier, loop back
    const existingIdx = currentPath.findIndex(([pr, pc]) => pr === r && pc === c)
    if (existingIdx !== -1) {
      setPaths(prev => ({
        ...prev,
        [activeColorId]: prev[activeColorId].slice(0, existingIdx + 1),
      }))
      return
    }

    // Add cell to path
    const newPath: [number, number][] = [...currentPath, [r, c]]
    const newPaths = {
      ...paths,
      [activeColorId]: newPath,
    }
    setPaths(newPaths)
    playStepSound(newPath.length)

    // Check if reached the OTHER endpoint for this color
    if (epColor === activeColorId && isEndpoint(r, c, activeColorId)) {
      const startEp = currentLevel.endpoints[activeColorId][0]
      const endEp = currentLevel.endpoints[activeColorId][1]
      const [firstR, firstC] = newPath[0]
      const wasStartFirst = firstR === startEp[0] && firstC === startEp[1]
      const targetEp = wasStartFirst ? endEp : startEp

      if (r === targetEp[0] && c === targetEp[1]) {
        // Connected!
        playConnectSound()
        const newConnected = Array.from(new Set([...connectedColors, activeColorId]))
        setConnectedColors(newConnected)
        setActiveColorId(null)

        // Check overall win condition
        checkVictory(newPaths, newConnected)
      }
    }
  }

  const handlePointerUp = () => {
    setActiveColorId(null)
  }

  const checkVictory = (currentPaths: { [colorId: number]: [number, number][] }, connected: number[]) => {
    const totalPairs = Object.keys(currentLevel.endpoints).length
    if (connected.length !== totalPairs) return

    // Calculate cell coverage
    const occupiedCells = new Set<string>()
    for (const p of Object.values(currentPaths)) {
      for (const [r, c] of p) {
        occupiedCells.add(`${r},${c}`)
      }
    }
    const coverage = occupiedCells.size / (size * size)

    // Calculate score
    const timeSec = Math.max(1, Math.round(elapsedMs / 1000))
    const baseScore = currentLevel.levelNumber * 1200
    const coverageBonus = Math.round(coverage * 800)
    const speedBonus = Math.max(0, 1500 - timeSec * 15)
    const finalScore = Math.round(baseScore + coverageBonus + speedBonus)

    setLevelScore(finalScore)
    setIsWon(true)
    playSuccessChime()

    onComplete({
      gameId: "flow_lines",
      score: finalScore,
      level: currentLevel.levelNumber,
      timeMs: elapsedMs,
      moves: moves + 1,
      metadata: {
        coverage: Math.round(coverage * 100),
        size,
      },
    })
  }

  // Calculate stats
  const totalPairs = Object.keys(currentLevel.endpoints).length
  const connectedCount = connectedColors.length
  let totalOccupied = 0
  for (const p of Object.values(paths)) totalOccupied += p.length
  const coveragePercent = Math.min(100, Math.round((totalOccupied / (size * size)) * 100))

  return (
    <div
      className="flex flex-col items-center select-none"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Top Controls & Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
            {currentLevel.title}
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {connectedCount}/{totalPairs} Fluxos • {coveragePercent}% Tabuleiro
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <span className="text-[11px] text-[var(--text-tertiary)] block">Tempo</span>
            <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          <button
            onClick={() => initLevel(currentLevel)}
            title="Reiniciar nível"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div
        ref={boardRef}
        className="relative p-2.5 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md touch-none"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gap: "4px",
          width: size >= 7 ? "350px" : size === 6 ? "320px" : "300px",
          height: size >= 7 ? "350px" : size === 6 ? "320px" : "300px",
        }}
      >
        {Array.from({ length: size }).map((_, r) =>
          Array.from({ length: size }).map((_, c) => {
            const epColorId = getEndpointAt(r, c)
            const occupant = getCellOccupant(r, c)
            const activeColor = epColorId
              ? COLORS.find(cl => cl.id === epColorId)
              : occupant
              ? COLORS.find(cl => cl.id === occupant.colorId)
              : null

            return (
              <div
                key={`${r}-${c}`}
                onPointerDown={e => {
                  e.preventDefault()
                  handleCellDown(r, c)
                }}
                onPointerEnter={() => handleCellEnter(r, c)}
                className={`relative flex items-center justify-center rounded-lg cursor-pointer transition-all ${
                  occupant && !epColorId
                    ? "bg-[var(--surface-muted)]"
                    : "bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)]"
                }`}
              >
                {/* Path indicator */}
                {occupant && activeColor && (
                  <div
                    className="absolute inset-1.5 rounded-md opacity-85 transition-transform"
                    style={{ backgroundColor: activeColor.color }}
                  />
                )}

                {/* Endpoint circle */}
                {epColorId && activeColor && (
                  <div
                    className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-sm border-2 border-white/80 animate-pulse"
                    style={{ backgroundColor: activeColor.color }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white/90" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Level Indicator & Legend */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {FLOW_LEVELS.map((lvl, i) => (
            <button
              key={lvl.levelNumber}
              onClick={() => {
                setLevelIdx(i)
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvl.levelNumber}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[var(--text-tertiary)]">
          {moves} movimentos • Toque e arraste para ligar
        </span>
      </div>

      {/* Win Modal Banner */}
      {isWon && (
        <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex flex-col gap-2 items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm">Nível {currentLevel.levelNumber} Concluído com Sucesso!</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Pontuação registada no Ranking: <strong className="font-bold">+{levelScore} XP</strong> em {(elapsedMs / 1000).toFixed(1)}s!
          </p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => initLevel(currentLevel)}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            {levelIdx < FLOW_LEVELS.length - 1 && (
              <button
                onClick={() => setLevelIdx(prev => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
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

