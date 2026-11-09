"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEmployee } from "@/lib/auth/context"
import { getMyProfile } from "@/lib/auth/profile"
import { listStaffAuthUsers, loadStaffDirectory, staffEmail } from "@/lib/auth/staff-directory"

export type OpsGameId = "flow_lines" | "one_stroke" | "number_path" | "memory_matrix" | "speed_math"

export interface OpsGameScoreRecord {
  id: string
  user_id: string
  colaborador_id?: string
  user_name: string
  user_email: string
  user_role: string
  avatar_url?: string
  avatar_color?: string
  game_id: OpsGameId
  score: number
  level: number
  time_ms: number
  moves: number
  created_at: string
}

export interface OpsTeamMemberStats {
  player_key: string
  user_id?: string
  colaborador_id?: string
  name: string
  email: string
  role: string
  avatar_url?: string
  avatar_color: string
  total_xp: number
  games_played: number
  best_by_game: Partial<Record<OpsGameId, {
    score: number
    level: number
    time_ms: number
    moves: number
    created_at: string
  }>>
  last_played_at?: string
  badges: string[]
}

export interface OpsGamesDashboardData {
  currentPlayer: {
    user_id: string
    colaborador_id?: string
    name: string
    email: string
    role: string
    avatar_url?: string
    avatar_color: string
  }
  leaderboard: OpsTeamMemberStats[]
  recentScores: OpsGameScoreRecord[]
}

const AUDIT_ACTION = "ops_brain_game_score"

export async function getOpsGamesDashboardAction(): Promise<OpsGamesDashboardData> {
  const ctx = await requireEmployee()
  const db = createAdminClient()

  const [profile, authUsers, scoreLogsResult] = await Promise.all([
    getMyProfile().catch(() => null),
    listStaffAuthUsers(db).catch(() => []),
    db
      .from("audit_log")
      .select("id, details, created_at")
      .eq("tenant_id", ctx.tenant_id)
      .eq("action", AUDIT_ACTION)
      .order("created_at", { ascending: false })
      .limit(1000),
  ])

  const directory = await loadStaffDirectory(db, ctx.tenant_id, authUsers).catch(() => [])
  const currentEmail = staffEmail(ctx.user?.email)
  const myColab = directory.find(
    c => (ctx.colaborador_id && c.id === ctx.colaborador_id) || staffEmail(c.email) === currentEmail
  )

  const currentPlayer = {
    user_id: ctx.user.id,
    colaborador_id: myColab?.id || ctx.colaborador_id || undefined,
    name:
      profile?.name ||
      myColab?.name ||
      (typeof ctx.user?.user_metadata?.full_name === "string" ? ctx.user.user_metadata.full_name : "") ||
      (typeof ctx.user?.user_metadata?.name === "string" ? ctx.user.user_metadata.name : "") ||
      currentEmail.split("@")[0] ||
      "Operador",
    email: currentEmail,
    role: myColab?.role || (ctx.role === "admin" ? "Administração" : "Operações"),
    avatar_url:
      profile?.avatar_url ||
      myColab?.avatar ||
      (typeof ctx.user?.user_metadata?.avatar === "string" ? ctx.user.user_metadata.avatar : undefined),
    avatar_color: myColab?.avatar_color || "#16a34a",
  }

  // Build map of team members from active staff directory
  const playersMap = new Map<string, OpsTeamMemberStats>()

  for (const colab of directory) {
    if (colab.status === "Inativo") continue
    const key = staffEmail(colab.email) || colab.id
    playersMap.set(key, {
      player_key: key,
      colaborador_id: colab.id,
      name: colab.name,
      email: staffEmail(colab.email),
      role: colab.role || colab.department || "Equipa OPS",
      avatar_url: colab.avatar || undefined,
      avatar_color: colab.avatar_color || "#16a34a",
      total_xp: 0,
      games_played: 0,
      best_by_game: {},
      badges: [],
    })
  }

  // Ensure current player is always in the map
  const currentKey = currentPlayer.email || currentPlayer.user_id
  if (!playersMap.has(currentKey)) {
    playersMap.set(currentKey, {
      player_key: currentKey,
      user_id: currentPlayer.user_id,
      colaborador_id: currentPlayer.colaborador_id,
      name: currentPlayer.name,
      email: currentPlayer.email,
      role: currentPlayer.role,
      avatar_url: currentPlayer.avatar_url,
      avatar_color: currentPlayer.avatar_color,
      total_xp: 0,
      games_played: 0,
      best_by_game: {},
      badges: [],
    })
  } else {
    const existing = playersMap.get(currentKey)!
    existing.user_id = currentPlayer.user_id
    if (currentPlayer.avatar_url) existing.avatar_url = currentPlayer.avatar_url
  }

  const rawLogs = scoreLogsResult.data || []
  const recentScores: OpsGameScoreRecord[] = []

  for (const row of rawLogs) {
    const d = (row.details || {}) as Record<string, unknown>
    const gameId = String(d.game_id || "") as OpsGameId
    if (!["flow_lines", "one_stroke", "number_path", "memory_matrix", "speed_math"].includes(gameId)) continue

    const score = Math.max(0, Number(d.score) || 0)
    const level = Math.max(1, Number(d.level) || 1)
    const timeMs = Math.max(0, Number(d.time_ms) || 0)
    const moves = Math.max(0, Number(d.moves) || 0)
    const userEmail = staffEmail(String(d.user_email || ""))
    const userId = String(d.user_id || "")
    const playerKey = userEmail || userId || String(row.id)

    let stats = playersMap.get(playerKey)
    if (!stats && userId) {
      stats = [...playersMap.values()].find(p => p.user_id === userId)
    }
    if (!stats) {
      stats = {
        player_key: playerKey,
        user_id: userId,
        colaborador_id: typeof d.colaborador_id === "string" ? d.colaborador_id : undefined,
        name: String(d.user_name || userEmail.split("@")[0] || "Operador"),
        email: userEmail,
        role: String(d.user_role || "Equipa OPS"),
        avatar_url: typeof d.avatar_url === "string" && d.avatar_url ? d.avatar_url : undefined,
        avatar_color: typeof d.avatar_color === "string" && d.avatar_color ? d.avatar_color : "#16a34a",
        total_xp: 0,
        games_played: 0,
        best_by_game: {},
        badges: [],
      }
      playersMap.set(playerKey, stats)
    }

    const record: OpsGameScoreRecord = {
      id: String(row.id),
      user_id: userId,
      colaborador_id: stats.colaborador_id,
      user_name: stats.name,
      user_email: stats.email,
      user_role: stats.role,
      avatar_url: stats.avatar_url,
      avatar_color: stats.avatar_color,
      game_id: gameId,
      score,
      level,
      time_ms: timeMs,
      moves,
      created_at: String(row.created_at || d.created_at || new Date().toISOString()),
    }

    if (recentScores.length < 40) {
      recentScores.push(record)
    }

    stats.games_played += 1
    if (!stats.last_played_at || record.created_at > stats.last_played_at) {
      stats.last_played_at = record.created_at
    }

    const prevBest = stats.best_by_game[gameId]
    if (!prevBest || score > prevBest.score || (score === prevBest.score && timeMs < prevBest.time_ms)) {
      stats.best_by_game[gameId] = {
        score,
        level,
        time_ms: timeMs,
        moves,
        created_at: record.created_at,
      }
    }
  }

  // Compute total XP = sum of best scores across all 5 games + activity bonus (15 XP per game played up to 300 XP)
  const allStats = [...playersMap.values()]
  for (const st of allStats) {
    const bestSum = Object.values(st.best_by_game).reduce((acc, b) => acc + (b?.score || 0), 0)
    const activityBonus = Math.min(300, st.games_played * 15)
    st.total_xp = bestSum + activityBonus

    const badges: string[] = []
    const gamesUnlocked = Object.keys(st.best_by_game).length
    if (gamesUnlocked >= 5) badges.push("Mestre Polivalente")
    if ((st.best_by_game.flow_lines?.level || 0) >= 4) badges.push("Arquiteto de Linhas")
    if ((st.best_by_game.one_stroke?.level || 0) >= 4) badges.push("Mestre do Traço")
    if ((st.best_by_game.number_path?.level || 0) >= 3) badges.push("Rota Perfeita")
    if ((st.best_by_game.memory_matrix?.level || 0) >= 5) badges.push("Memória Fotográfica")
    if ((st.best_by_game.speed_math?.score || 0) >= 500) badges.push("Calculadora Humana")
    if (st.games_played >= 10) badges.push("Veterano OPS")
    st.badges = badges
  }

  allStats.sort((a, b) => {
    if (b.total_xp !== a.total_xp) return b.total_xp - a.total_xp
    if (b.games_played !== a.games_played) return b.games_played - a.games_played
    return a.name.localeCompare(b.name)
  })

  return {
    currentPlayer,
    leaderboard: allStats,
    recentScores,
  }
}

export async function submitOpsGameScoreAction(input: {
  gameId: OpsGameId
  score: number
  level: number
  timeMs: number
  moves: number
}): Promise<{ ok: boolean; error?: string; dashboard?: OpsGamesDashboardData }> {
  try {
    const ctx = await requireEmployee()
    const db = createAdminClient()

    const validGames: OpsGameId[] = ["flow_lines", "one_stroke", "number_path", "memory_matrix", "speed_math"]
    if (!validGames.includes(input.gameId)) {
      return { ok: false, error: "Jogo inválido." }
    }

    const cleanScore = Math.max(0, Math.min(50000, Math.round(Number(input.score) || 0)))
    const cleanLevel = Math.max(1, Math.min(100, Math.round(Number(input.level) || 1)))
    const cleanTimeMs = Math.max(0, Math.round(Number(input.timeMs) || 0))
    const cleanMoves = Math.max(0, Math.round(Number(input.moves) || 0))

    if (cleanScore <= 0) {
      return { ok: false, error: "A pontuação deve ser superior a zero." }
    }

    const [profile, authUsers] = await Promise.all([
      getMyProfile().catch(() => null),
      listStaffAuthUsers(db).catch(() => []),
    ])
    const directory = await loadStaffDirectory(db, ctx.tenant_id, authUsers).catch(() => [])
    const currentEmail = staffEmail(ctx.user?.email)
    const myColab = directory.find(
      c => (ctx.colaborador_id && c.id === ctx.colaborador_id) || staffEmail(c.email) === currentEmail
    )

    const userName =
      profile?.name ||
      myColab?.name ||
      (typeof ctx.user?.user_metadata?.full_name === "string" ? ctx.user.user_metadata.full_name : "") ||
      (typeof ctx.user?.user_metadata?.name === "string" ? ctx.user.user_metadata.name : "") ||
      currentEmail.split("@")[0] ||
      "Operador"

    const avatarUrl =
      profile?.avatar_url ||
      myColab?.avatar ||
      (typeof ctx.user?.user_metadata?.avatar === "string" ? ctx.user.user_metadata.avatar : undefined)

    const now = new Date().toISOString()

    const { error } = await db.from("audit_log").insert({
      tenant_id: ctx.tenant_id,
      action: AUDIT_ACTION,
      details: {
        user_id: ctx.user.id,
        colaborador_id: myColab?.id || ctx.colaborador_id,
        user_name: userName,
        user_email: currentEmail,
        user_role: myColab?.role || (ctx.role === "admin" ? "Administração" : "Operações"),
        avatar_url: avatarUrl || null,
        avatar_color: myColab?.avatar_color || "#16a34a",
        game_id: input.gameId,
        score: cleanScore,
        level: cleanLevel,
        time_ms: cleanTimeMs,
        moves: cleanMoves,
        created_at: now,
      },
      created_at: now,
    })

    if (error) {
      return { ok: false, error: "Não foi possível registar a pontuação no ranking." }
    }

    revalidatePath("/ops/jogos")
    const dashboard = await getOpsGamesDashboardAction()
    return { ok: true, dashboard }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao guardar pontuação.",
    }
  }
}

