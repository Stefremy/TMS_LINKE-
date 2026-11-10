"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { RotateCcw, CheckCircle2, ArrowRight, Lightbulb, Shuffle } from "lucide-react"
import { playConnectSound, playStepSound, playSuccessChime } from "../lib/audio"
import { generateFlowLevel, getLisbonDateKey, type GeneratedFlowLevel } from "../lib/puzzle-generator"
import type { GameCompletionEvent } from "../types"

interface PairColor {
  id: number
  name: string
  color: string
}

const COLORS: PairColor[] = [
  { id: 1, name: "Vermelho", color: "#ef4444" },
  { id: 2, name: "Azul", color: "#3b82f6" },
  { id: 3, name: "Verde", color: "#10b981" },
  { id: 4, name: "Amarelo", color: "#f59e0b" },
  { id: 5, name: "Roxo", color: "#8b5cf6" },
  { id: 6, name: "Ciano", color: "#06b6d4" },
  { id: 7, name: "Rosa", color: "#ec4899" },
]

const TOTAL_LEVELS = 5

export function FlowLinesGame({
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
    () => generateFlowLevel(levelIdx + 1, effectiveDailyKey, variant),
    [levelIdx, effectiveDailyKey, variant]
  )

  return (
    <FlowLinesBoard
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

function FlowLinesBoard({
  level,
  levelIdx,
  variant,
  onSelectLevel,
  onRestart,
  onNewVariant,
  onNextLevel,
  onComplete,
}: {
  level: GeneratedFlowLevel
  levelIdx: number
  variant: number
  onSelectLevel: (idx: number) => void
  onRestart: () => void
  onNewVariant: () => void
  onNextLevel: () => void
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [activeColorId, setActiveColorId] = useState<number | null>(null)
  const [paths, setPaths] = useState<{ [colorId: number]: [number, number][] }>({})
  const [connectedColors, setConnectedColors] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isWon, setIsWon] = useState(false)
  const [levelScore, setLevelScore] = useState(0)

  const size = level.size

  useEffect(() => {
    if (isWon) return
    const startedAt = Date.now()
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 100)
    return () => clearInterval(interval)
  }, [isWon])

  const isEndpoint = useCallback(
    (r: number, c: number, colorId: number): boolean => {
      const pair = level.endpoints[colorId]
      if (!pair) return false
      return (pair[0][0] === r && pair[0][1] === c) || (pair[1][0] === r && pair[1][1] === c)
    },
    [level]
  )

  const getEndpointAt = useCallback(
    (r: number, c: number): number | null => {
      for (const [cIdStr, pair] of Object.entries(level.endpoints)) {
        const cId = Number(cIdStr)
        if ((pair[0][0] === r && pair[0][1] === c) || (pair[1][0] === r && pair[1][1] === c)) {
          return cId
        }
      }
      return null
    },
    [level]
  )

  const getCellOccupant = useCallback(
    (
      r: number,
      c: number,
      sourcePaths: { [colorId: number]: [number, number][] } = paths
    ): { colorId: number; idx: number } | null => {
      for (const [cIdStr, p] of Object.entries(sourcePaths)) {
        const cId = Number(cIdStr)
        const idx = p.findIndex(([pr, pc]) => pr === r && pc === c)
        if (idx !== -1) {
          return { colorId: cId, idx }
        }
      }
      return null
    },
    [paths]
  )

  const finalizeIfWon = useCallback(
    (
      currentPaths: { [colorId: number]: [number, number][] },
      connected: number[],
      moveTotal: number,
      hintsTotal: number
    ) => {
      const totalPairs = Object.keys(level.endpoints).length
      if (connected.length !== totalPairs) return

      const occupiedCells = new Set<string>()
      for (const p of Object.values(currentPaths)) {
        for (const [r, c] of p) {
          occupiedCells.add(`${r},${c}`)
        }
      }
      const coverage = occupiedCells.size / (size * size)
      const finalElapsed = elapsedMs
      const timeSec = Math.max(1, Math.round(finalElapsed / 1000))
      const baseScore = level.levelNumber * 1200
      const coverageBonus = Math.round(coverage * 800)
      const speedBonus = Math.max(0, 1500 - timeSec * 15)
      const hintPenalty = hintsTotal * 180
      const finalScore = Math.max(200, Math.round(baseScore + coverageBonus + speedBonus - hintPenalty))

      setLevelScore(finalScore)
      setIsWon(true)
      playSuccessChime()

      onComplete({
        gameId: "flow_lines",
        score: finalScore,
        level: level.levelNumber,
        timeMs: finalElapsed,
        moves: moveTotal,
        metadata: {
          coverage: Math.round(coverage * 100),
          size,
          hintsUsed: hintsTotal,
        },
      })
    },
    [elapsedMs, level, onComplete, size]
  )

  const handleCellDown = (r: number, c: number) => {
    if (isWon) return
    const epColor = getEndpointAt(r, c)
    const occupant = getCellOccupant(r, c)

    if (epColor) {
      setPaths(prev => ({
        ...prev,
        [epColor]: [[r, c]],
      }))
      setConnectedColors(prev => prev.filter(id => id !== epColor))
      setActiveColorId(epColor)
      setMoves(m => m + 1)
      playStepSound(epColor)
    } else if (occupant) {
      setPaths(prev => ({
        ...prev,
        [occupant.colorId]: prev[occupant.colorId].slice(0, occupant.idx + 1),
      }))
      setConnectedColors(prev => prev.filter(id => id !== occupant.colorId))
      setActiveColorId(occupant.colorId)
      playStepSound(occupant.colorId)
    }
  }

  const handleCellEnter = useCallback(
    (r: number, c: number) => {
      if (isWon || activeColorId === null) return

      const currentPath = paths[activeColorId] || []
      if (currentPath.length === 0) return

      const [lastR, lastC] = currentPath[currentPath.length - 1]
      if (lastR === r && lastC === c) return

      // Only allow orthogonal adjacency
      if (Math.abs(r - lastR) + Math.abs(c - lastC) !== 1) return

      // Backtrack 1 cell
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

      // Cannot cross another color's endpoint
      const epColor = getEndpointAt(r, c)
      if (epColor !== null && epColor !== activeColorId) return

      // Loop back to an earlier cell in the same path
      const existingIdx = currentPath.findIndex(([pr, pc]) => pr === r && pc === c)
      if (existingIdx !== -1) {
        setPaths(prev => ({
          ...prev,
          [activeColorId]: prev[activeColorId].slice(0, existingIdx + 1),
        }))
        return
      }

      // Trim another color's path if we cross it
      let nextConnected = connectedColors
      const newPaths = { ...paths }
      const occupant = getCellOccupant(r, c, newPaths)
      if (occupant && occupant.colorId !== activeColorId) {
        newPaths[occupant.colorId] = newPaths[occupant.colorId].slice(0, occupant.idx)
        nextConnected = nextConnected.filter(id => id !== occupant.colorId)
      }

      const newPath: [number, number][] = [...currentPath, [r, c]]
      newPaths[activeColorId] = newPath
      setPaths(newPaths)
      playStepSound(newPath.length)

      if (epColor === activeColorId && isEndpoint(r, c, activeColorId)) {
        const startEp = level.endpoints[activeColorId][0]
        const endEp = level.endpoints[activeColorId][1]
        const [firstR, firstC] = newPath[0]
        const targetEp = firstR === startEp[0] && firstC === startEp[1] ? endEp : startEp

        if (r === targetEp[0] && c === targetEp[1]) {
          playConnectSound()
          const updatedConnected = Array.from(new Set([...nextConnected, activeColorId]))
          setConnectedColors(updatedConnected)
          setActiveColorId(null)
          finalizeIfWon(newPaths, updatedConnected, moves + 1, hintsUsed)
          return
        }
      }

      if (nextConnected !== connectedColors) {
        setConnectedColors(nextConnected)
      }
    },
    [
      activeColorId,
      connectedColors,
      finalizeIfWon,
      getCellOccupant,
      getEndpointAt,
      hintsUsed,
      isEndpoint,
      isWon,
      level.endpoints,
      moves,
      paths,
    ]
  )

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isWon || activeColorId === null) return
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
      setActiveColorId(null)
      return
    }
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const cellEl = target?.closest("[data-flow-cell]") as HTMLElement | null
    if (!cellEl) return
    const raw = cellEl.dataset.flowCell
    if (!raw) return
    const [r, c] = raw.split(",").map(Number)
    handleCellEnter(r, c)
  }

  const handleHint = () => {
    if (isWon) return
    const allColorIds = Object.keys(level.endpoints).map(Number)
    const targetColorId = allColorIds.find(id => !connectedColors.includes(id))
    if (!targetColorId) return

    const solPath = level.solutionPaths[targetColorId]
    if (!solPath || solPath.length < 2) return

    const solKeys = new Set(solPath.map(([r, c]) => `${r},${c}`))
    const updatedPaths: { [colorId: number]: [number, number][] } = {}
    let nextConnected = connectedColors.filter(id => id !== targetColorId)

    for (const [cIdStr, existing] of Object.entries(paths)) {
      const cId = Number(cIdStr)
      if (cId === targetColorId) continue
      const collideIdx = existing.findIndex(([r, c]) => solKeys.has(`${r},${c}`))
      if (collideIdx !== -1) {
        updatedPaths[cId] = existing.slice(0, collideIdx)
        nextConnected = nextConnected.filter(id => id !== cId)
      } else {
        updatedPaths[cId] = existing
      }
    }

    updatedPaths[targetColorId] = solPath
    const finalConnected = Array.from(new Set([...nextConnected, targetColorId]))
    const nextHints = hintsUsed + 1

    setPaths(updatedPaths)
    setConnectedColors(finalConnected)
    setHintsUsed(nextHints)
    setActiveColorId(null)
    playConnectSound()

    finalizeIfWon(updatedPaths, finalConnected, moves + 1, nextHints)
  }

  const totalPairs = Object.keys(level.endpoints).length
  const connectedCount = connectedColors.length
  const uniqueCells = new Set<string>()
  for (const p of Object.values(paths)) {
    for (const [r, c] of p) uniqueCells.add(`${r},${c}`)
  }
  const coveragePercent = Math.min(100, Math.round((uniqueCells.size / (size * size)) * 100))

  return (
    <div
      className="flex flex-col items-center select-none"
      onPointerUp={() => setActiveColorId(null)}
      onPointerCancel={() => setActiveColorId(null)}
    >
      {/* Top Controls & Status */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {level.title}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase">
              {variant === 0 ? "Diário" : `Aleatório #${variant}`}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {connectedCount}/{totalPairs} Fluxos • {coveragePercent}% Tabuleiro
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
            disabled={isWon || connectedCount >= totalPairs}
            title="Revelar 1 fluxo garantido (Dica)"
            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
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
            title="Reiniciar tabuleiro"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div
        onPointerMove={handleBoardPointerMove}
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
                data-flow-cell={`${r},${c}`}
                onPointerDown={e => {
                  e.preventDefault()
                  handleCellDown(r, c)
                }}
                onPointerEnter={() => handleCellEnter(r, c)}
                className={`relative flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                  occupant && !epColorId
                    ? "bg-[var(--surface-muted)]"
                    : "bg-[var(--surface-muted)]/50 hover:bg-[var(--surface-muted)]"
                }`}
              >
                {occupant && activeColor && (
                  <div
                    className="absolute inset-1.5 rounded-md opacity-85 pointer-events-none"
                    style={{ backgroundColor: activeColor.color }}
                  />
                )}

                {epColorId && activeColor && (
                  <div
                    className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-sm border-2 border-white/80 pointer-events-none"
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

      {/* Bottom Level Selector */}
      <div className="w-full max-w-md mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((lvlNum, i) => (
            <button
              key={lvlNum}
              onClick={() => onSelectLevel(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                i === levelIdx
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
              }`}
            >
              {lvlNum}
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
            <span className="font-bold text-sm">Nível {level.levelNumber} Concluído com Sucesso!</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Pontuação registada no Ranking: <strong className="font-bold">+{levelScore} XP</strong> em {(elapsedMs / 1000).toFixed(1)}s!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <button
              onClick={onRestart}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold"
            >
              Repetir
            </button>
            <button
              onClick={onNewVariant}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1"
            >
              <Shuffle className="w-3 h-3" /> Novo Tabuleiro
            </button>
            {levelIdx < TOTAL_LEVELS - 1 && (
              <button
                onClick={onNextLevel}
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
