"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { RotateCcw, Zap, Flame, Award, Shuffle } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import {
  createRng,
  generateSpeedMathQuestion,
  getLisbonDateKey,
  type SpeedMathQuestion,
} from "../lib/puzzle-generator"
import type { GameCompletionEvent } from "../types"

function buildQuestion(dailyKey: string, variant: number, index: number): SpeedMathQuestion {
  const rng = createRng(`${dailyKey}|speed_math|v${variant}|q${index}`)
  return generateSpeedMathQuestion(rng, index)
}

export function SpeedMathGame({
  dailyKey,
  onComplete,
}: {
  dailyKey?: string
  onComplete: (event: GameCompletionEvent) => void
}) {
  const effectiveDailyKey = dailyKey || getLisbonDateKey()
  const [variant, setVariant] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [currentQ, setCurrentQ] = useState<SpeedMathQuestion | null>(null)
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [isGameOver, setIsGameOver] = useState(false)

  // Live refs so timer termination never submits stale 0-values
  const scoreRef = useRef(0)
  const correctCountRef = useRef(0)
  const maxStreakRef = useRef(0)
  const qIndexRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearFeedbackTimer()
  }, [clearFeedbackTimer])

  const startGame = (nextVariant = variant) => {
    clearFeedbackTimer()
    endedRef.current = false
    scoreRef.current = 0
    correctCountRef.current = 0
    maxStreakRef.current = 0
    qIndexRef.current = 0

    setVariant(nextVariant)
    setIsPlaying(true)
    setIsGameOver(false)
    setTimeLeft(60)
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setCorrectCount(0)
    setFeedback(null)
    setCurrentQ(buildQuestion(effectiveDailyKey, nextVariant, 0))
  }

  useEffect(() => {
    if (!isPlaying) return

    let remaining = 60
    const interval = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        if (!endedRef.current) {
          endedRef.current = true
          clearFeedbackTimer()
          setIsPlaying(false)
          setIsGameOver(true)
          playSuccessChime()

          const finalScore = scoreRef.current
          const finalCorrect = correctCountRef.current
          const finalStreak = maxStreakRef.current
          if (finalScore > 0) {
            onCompleteRef.current({
              gameId: "speed_math",
              score: finalScore,
              level: Math.floor(finalCorrect / 5) + 1,
              timeMs: 60000,
              moves: finalCorrect,
              metadata: {
                maxStreak: finalStreak,
                correctAnswers: finalCorrect,
              },
            })
          }
        }
        return
      }
      setTimeLeft(remaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, clearFeedbackTimer])

  const handleAnswer = (chosen: number) => {
    if (!isPlaying || !currentQ || feedback !== null) return

    if (chosen === currentQ.correct) {
      const newStreak = streak + 1
      const multiplier = Math.min(5, 1 + Math.floor(newStreak / 3))
      const pts = 100 * multiplier
      const nextScore = scoreRef.current + pts
      const nextCorrect = correctCountRef.current + 1
      const nextMaxStreak = Math.max(maxStreakRef.current, newStreak)

      scoreRef.current = nextScore
      correctCountRef.current = nextCorrect
      maxStreakRef.current = nextMaxStreak

      setScore(nextScore)
      setStreak(newStreak)
      setMaxStreak(nextMaxStreak)
      setCorrectCount(nextCorrect)
      setFeedback("correct")
      playStepSound(newStreak)
    } else {
      setStreak(0)
      setFeedback("wrong")
      playErrorBuzz()
    }

    const nextIdx = qIndexRef.current + 1
    qIndexRef.current = nextIdx
    clearFeedbackTimer()
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null)
      setCurrentQ(buildQuestion(effectiveDailyKey, variant, nextIdx))
    }, 150)
  }

  const multiplier = Math.min(5, 1 + Math.floor(streak / 3))

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> 60s de Reflexo
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-bold uppercase">
              {variant === 0 ? "Diário" : `Aleatório #${variant}`}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Pontos: <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{score} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {streak >= 3 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-amber-500" />
              {multiplier}x ({streak})
            </div>
          )}

          <div className="text-right">
            <span className="text-[11px] text-[var(--text-tertiary)] block">Tempo</span>
            <span
              className={`text-[14px] font-mono font-extrabold ${
                timeLeft <= 10 && isPlaying ? "text-rose-500 animate-pulse" : "text-[var(--text-primary)]"
              }`}
            >
              {timeLeft}s
            </span>
          </div>

          <button
            onClick={() => startGame(variant + 1)}
            title="Nova corrida aleatória"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={() => startGame(variant)}
            title="Reiniciar partida"
            className="p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface-bg)] border-2 border-[var(--border-subtle)] shadow-md flex flex-col items-center justify-center min-h-[300px]">
        {!isPlaying && !isGameOver ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">Cálculo Rápido & Mental</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">
                Responda ao maior número de contas logísticas e percentagens em 60 segundos. Manter a sequência dispara o multiplicador!
              </p>
            </div>
            <button
              onClick={() => startGame(variant)}
              className="mt-3 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              Iniciar Corrida
            </button>
          </div>
        ) : isGameOver ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center animate-in fade-in zoom-in-95">
            <Award className="w-10 h-10 text-rose-500" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Tempo Esgotado!</h3>
            <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 my-1">
              +{score} XP
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {correctCount} respostas corretas • Melhor sequência: {maxStreak} em combo
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => startGame(variant)}
                className="px-4 py-2 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-xs font-semibold"
              >
                Repetir Série
              </button>
              <button
                onClick={() => startGame(variant + 1)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1"
              >
                <Shuffle className="w-3.5 h-3.5" /> Nova Corrida
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-wide py-3 px-6 rounded-2xl transition-all text-center ${
                feedback === "correct"
                  ? "bg-emerald-500/10 text-emerald-600 scale-105"
                  : feedback === "wrong"
                  ? "bg-rose-500/10 text-rose-600 scale-95"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {currentQ?.prompt}
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {currentQ?.options.map((opt, i) => (
                <button
                  key={`${i}-${opt}`}
                  type="button"
                  onClick={() => handleAnswer(opt)}
                  className="py-4 px-3 rounded-xl bg-[var(--surface-muted)] hover:bg-rose-500 hover:text-white font-mono font-bold text-lg sm:text-xl border border-[var(--border-subtle)] hover:border-rose-600 shadow-xs active:scale-95 transition-all text-[var(--text-primary)]"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
