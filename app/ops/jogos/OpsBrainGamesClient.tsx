"use client"

import React, { useState, useTransition } from "react"
import { 
  Trophy, 
  Gamepad2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Flame, 
  ChevronRight, 
  ArrowLeft,
  Crown,
  BrainCircuit,
  Zap,
  PenTool,
  GitCommit,
  Milestone
} from "lucide-react"
import type { OpsGamesDashboardData, OpsGameId, GameCompletionEvent } from "./types"
import { OPS_GAMES } from "./types"
import { FlowLinesGame } from "./components/FlowLinesGame"
import { OneStrokeGame } from "./components/OneStrokeGame"
import { NumberPathGame } from "./components/NumberPathGame"
import { MemoryMatrixGame } from "./components/MemoryMatrixGame"
import { SpeedMathGame } from "./components/SpeedMathGame"
import { LeaderboardView } from "./components/LeaderboardView"
import { setSoundMuted, isSoundMuted } from "./lib/audio"
import { submitOpsGameScoreAction } from "@/app/actions/ops-games"

export function OpsBrainGamesClient({
  initialDashboard,
}: {
  initialDashboard: OpsGamesDashboardData
}) {
  const [dashboard, setDashboard] = useState<OpsGamesDashboardData>(initialDashboard)
  const [activeTab, setActiveTab] = useState<"games" | "leaderboard">("games")
  const [selectedGameId, setSelectedGameId] = useState<OpsGameId | null>("flow_lines")
  const [muted, setMuted] = useState(false)
  const [recentToast, setRecentToast] = useState<{ score: number; gameTitle: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleToggleMute = () => {
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
  }

  const handleGameComplete = (event: GameCompletionEvent) => {
    const gameMeta = OPS_GAMES.find(g => g.id === event.gameId)
    setRecentToast({
      score: event.score,
      gameTitle: gameMeta?.title || "Jogo",
    })

    setTimeout(() => {
      setRecentToast(null)
    }, 4000)

    startTransition(async () => {
      const res = await submitOpsGameScoreAction({
        gameId: event.gameId,
        score: event.score,
        level: event.level,
        timeMs: event.timeMs,
        moves: event.moves,
      })

      if (res.ok && res.dashboard) {
        setDashboard(res.dashboard)
      }
    })
  }

  const myStats = dashboard.leaderboard.find(
    p => p.email === dashboard.currentPlayer.email || p.user_id === dashboard.currentPlayer.user_id
  )
  const myRank = dashboard.leaderboard.findIndex(
    p => p.email === dashboard.currentPlayer.email || p.user_id === dashboard.currentPlayer.user_id
  ) + 1

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
      {/* Toast Notification */}
      {recentToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 p-4 rounded-xl bg-emerald-600 text-white shadow-xl animate-in slide-in-from-top-4 duration-300">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-emerald-100">Recorde Registado!</p>
            <p className="text-sm font-extrabold">+{recentToast.score} XP em {recentToast.gameTitle}</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-[var(--surface-bg)] to-blue-600/10 border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px] font-extrabold uppercase tracking-wide">
              OPS Arena
            </span>
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">TMS Linke Brain Games</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Jogos Mentais & Classificação da Equipa
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            Puzzles de lógica espacial, conexões de linhas e desafios rápidos para a equipa de operações.
          </p>
        </div>

        {/* Player Stats Chip & Audio Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shadow-xs"
            title={muted ? "Ativar som" : "Desativar som"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
          </button>

          <div className="flex items-center gap-3 p-2 pr-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">
              {dashboard.currentPlayer.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dashboard.currentPlayer.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                dashboard.currentPlayer.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="text-left">
              <div className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
                <span>{dashboard.currentPlayer.name.split(" ")[0]}</span>
                {myRank > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold">
                    #{myRank}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono font-bold text-[var(--accent)]">
                {myStats?.total_xp || 0} XP Acumulados
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("games")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "games"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Arena de Jogos
          </button>

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "leaderboard"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Ranking & Pódio
          </button>
        </div>

        <span className="text-xs text-[var(--text-tertiary)] hidden sm:inline">
          {dashboard.leaderboard.length} colaboradores ativos
        </span>
      </div>

      {/* Tab Content: Games */}
      {activeTab === "games" && (
        <div className="flex flex-col gap-6">
          {/* Game Selection Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {OPS_GAMES.map(game => {
              const isSelected = selectedGameId === game.id
              const bestScore = myStats?.best_by_game[game.id]?.score

              return (
                <button
                  key={game.id}
                  onClick={() => setSelectedGameId(game.id)}
                  className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                    isSelected
                      ? "bg-[var(--surface-bg)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-md scale-[1.02]"
                      : "bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border-[var(--border-subtle)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`p-2 rounded-xl ${game.bgColor} border ${game.borderColor}`}>
                        {game.id === "flow_lines" && <GitCommit className="w-4 h-4" style={{ color: game.color }} />}
                        {game.id === "one_stroke" && <PenTool className="w-4 h-4" style={{ color: game.color }} />}
                        {game.id === "number_path" && <Milestone className="w-4 h-4" style={{ color: game.color }} />}
                        {game.id === "memory_matrix" && <BrainCircuit className="w-4 h-4" style={{ color: game.color }} />}
                        {game.id === "speed_math" && <Zap className="w-4 h-4" style={{ color: game.color }} />}
                      </span>
                      {bestScore !== undefined && bestScore > 0 && (
                        <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                          {bestScore} pts
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-[var(--text-primary)] leading-tight">
                      {game.title}
                    </h3>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                      {game.subtitle}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active Game Canvas Card */}
          {selectedGameId && (
            <div className="rounded-3xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-sm p-4 sm:p-6">
              {selectedGameId === "flow_lines" && (
                <FlowLinesGame onComplete={handleGameComplete} />
              )}
              {selectedGameId === "one_stroke" && (
                <OneStrokeGame onComplete={handleGameComplete} />
              )}
              {selectedGameId === "number_path" && (
                <NumberPathGame onComplete={handleGameComplete} />
              )}
              {selectedGameId === "memory_matrix" && (
                <MemoryMatrixGame onComplete={handleGameComplete} />
              )}
              {selectedGameId === "speed_math" && (
                <SpeedMathGame onComplete={handleGameComplete} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Leaderboard */}
      {activeTab === "leaderboard" && (
        <LeaderboardView
          data={dashboard}
          onSelectGame={gameId => {
            setSelectedGameId(gameId)
            setActiveTab("games")
          }}
        />
      )}
    </div>
  )
}

