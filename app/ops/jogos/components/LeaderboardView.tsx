"use client"

import React, { useState } from "react"
import { Trophy, Medal, Crown, Sparkles, Flame, User, Gamepad2, Clock, CheckCircle } from "lucide-react"
import type { OpsGamesDashboardData, OpsTeamMemberStats, OpsGameScoreRecord, OpsGameId } from "../types"
import { OPS_GAMES } from "../types"

interface LeaderboardViewProps {
  data: OpsGamesDashboardData
  onSelectGame?: (gameId: OpsGameId) => void
}

export function LeaderboardView({ data, onSelectGame }: LeaderboardViewProps) {
  const [filterGame, setFilterGame] = useState<"all" | OpsGameId>("all")

  const { leaderboard, recentScores, currentPlayer } = data

  // Filter or sort by selected game
  const sortedPlayers = [...leaderboard].sort((a, b) => {
    if (filterGame === "all") {
      return b.total_xp - a.total_xp
    }
    const scoreA = a.best_by_game[filterGame]?.score || 0
    const scoreB = b.best_by_game[filterGame]?.score || 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return (a.best_by_game[filterGame]?.time_ms || 999999) - (b.best_by_game[filterGame]?.time_ms || 999999)
  })

  const top3 = sortedPlayers.slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="relative pt-8 pb-4 px-4 rounded-2xl bg-gradient-to-b from-[var(--surface-bg)] to-[var(--surface-muted)] border border-[var(--border-subtle)] shadow-xs">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" /> Pódio da Equipa OPS
            </span>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">
              {filterGame === "all"
                ? "Líderes de Desempenho Global"
                : `Melhores em ${OPS_GAMES.find(g => g.id === filterGame)?.title}`}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto items-end">
            {/* 2nd Place */}
            {top3[1] ? (
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full border-2 border-slate-300 dark:border-slate-500 overflow-hidden shadow-sm bg-slate-100 flex items-center justify-center">
                    {top3[1].avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top3[1].avatar_url} alt={top3[1].name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-slate-700">{top3[1].name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-extrabold text-xs flex items-center justify-center shadow-xs">
                    2
                  </div>
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{top3[1].name.split(" ")[0]}</p>
                  <p className="text-[11px] font-mono font-extrabold text-[var(--accent)]">
                    {filterGame === "all" ? `${top3[1].total_xp} XP` : `${top3[1].best_by_game[filterGame]?.score || 0} pts`}
                  </p>
                </div>
                <div className="w-full h-16 sm:h-20 mt-2 rounded-t-xl bg-slate-200 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 font-bold">
                  2º
                </div>
              </div>
            ) : <div />}

            {/* 1st Place */}
            {top3[0] && (
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <Crown className="w-6 h-6 text-amber-500 absolute -top-5 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 overflow-hidden shadow-md bg-amber-50 flex items-center justify-center ring-4 ring-amber-400/20">
                    {top3[0].avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top3[0].avatar_url} alt={top3[0].name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-amber-800 text-base">{top3[0].name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-extrabold text-sm flex items-center justify-center shadow-sm">
                    1
                  </div>
                </div>
                <div className="text-center w-full">
                  <p className="text-sm font-extrabold text-[var(--text-primary)] truncate">{top3[0].name.split(" ")[0]}</p>
                  <p className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                    {filterGame === "all" ? `${top3[0].total_xp} XP` : `${top3[0].best_by_game[filterGame]?.score || 0} pts`}
                  </p>
                </div>
                <div className="w-full h-24 sm:h-28 mt-2 rounded-t-xl bg-gradient-to-t from-amber-500/20 to-amber-500/10 border-t-2 border-amber-400 flex items-center justify-center text-amber-500 font-extrabold text-lg">
                  1º
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {top3[2] ? (
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full border-2 border-amber-700/60 overflow-hidden shadow-sm bg-amber-950/10 flex items-center justify-center">
                    {top3[2].avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top3[2].avatar_url} alt={top3[2].name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-amber-900">{top3[2].name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                    3
                  </div>
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{top3[2].name.split(" ")[0]}</p>
                  <p className="text-[11px] font-mono font-extrabold text-[var(--accent)]">
                    {filterGame === "all" ? `${top3[2].total_xp} XP` : `${top3[2].best_by_game[filterGame]?.score || 0} pts`}
                  </p>
                </div>
                <div className="w-full h-12 sm:h-16 mt-2 rounded-t-xl bg-amber-900/10 dark:bg-amber-950/30 border-t-2 border-amber-700/50 flex items-center justify-center text-amber-700 font-bold">
                  3º
                </div>
              </div>
            ) : <div />}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setFilterGame("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            filterGame === "all"
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
          }`}
        >
          🏆 Geral (Todos os Jogos)
        </button>
        {OPS_GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => setFilterGame(g.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterGame === g.id
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
            }`}
          >
            {g.title}
          </button>
        ))}
      </div>

      {/* Table & Live Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Ranking Table (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">
              Tabela de Classificação da Equipa ({sortedPlayers.length} Colaboradores)
            </h3>
            <span className="text-xs text-[var(--text-tertiary)]">Atualização em Tempo Real</span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {sortedPlayers.map((player, idx) => {
              const isCurrent = player.email === currentPlayer.email || player.user_id === currentPlayer.user_id
              const rank = idx + 1
              const gameStats = filterGame !== "all" ? player.best_by_game[filterGame] : null

              return (
                <div
                  key={player.player_key}
                  className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isCurrent ? "bg-[var(--accent)]/5 border-l-4 border-[var(--accent)]" : "hover:bg-[var(--surface-muted)]/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 text-center font-mono font-extrabold text-sm ${
                        rank === 1
                          ? "text-amber-500"
                          : rank === 2
                          ? "text-slate-400"
                          : rank === 3
                          ? "text-amber-700"
                          : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      #{rank}
                    </span>

                    <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--surface-muted)] shrink-0 flex items-center justify-center border border-[var(--border-subtle)]">
                      {player.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.avatar_url} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-[var(--text-secondary)]">
                          {player.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                          {player.name}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--accent)]/15 text-[var(--accent)]">
                            Você
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)] block truncate">
                        {player.role}
                      </span>
                    </div>
                  </div>

                  {/* Right Score */}
                  <div className="text-right shrink-0">
                    {filterGame === "all" ? (
                      <div>
                        <span className="font-mono font-extrabold text-sm text-[var(--text-primary)] block">
                          {player.total_xp} <span className="text-xs text-[var(--text-tertiary)]">XP</span>
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {player.games_played} jogos disputados
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono font-extrabold text-sm text-[var(--text-primary)] block">
                          {gameStats ? `${gameStats.score} pts` : "—"}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {gameStats ? `Nível ${gameStats.level} • ${(gameStats.time_ms / 1000).toFixed(1)}s` : "Não jogou"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Records Ticker (1 Col) */}
        <div className="rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
            <Flame className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Últimos Recordes Batidos</h3>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
            {recentScores.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] text-center py-8">
                Nenhum recorde registado ainda. Seja o primeiro a jogar e inaugurar a tabela!
              </p>
            ) : (
              recentScores.slice(0, 15).map(item => {
                const gameMeta = OPS_GAMES.find(g => g.id === item.game_id)
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)] text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)] truncate">{item.user_name}</span>
                      <span className="font-mono font-extrabold text-[var(--accent)]">+{item.score} XP</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                      <span>{gameMeta?.title || item.game_id} (Nível {item.level})</span>
                      <span>{(item.time_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

