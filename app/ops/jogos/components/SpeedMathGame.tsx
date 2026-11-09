"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Play, RotateCcw, Zap, Flame, Award, CheckCircle2 } from "lucide-react"
import { playStepSound, playSuccessChime, playErrorBuzz } from "../lib/audio"
import type { GameCompletionEvent } from "../types"

interface Question {
  prompt: string
  correct: number
  options: number[]
}

function generateQuestion(): Question {
  const types = ["add", "sub", "mul", "div", "logistics"]
  const type = types[Math.floor(Math.random() * types.length)]

  let prompt = ""
  let correct = 0

  if (type === "add") {
    const a = Math.floor(Math.random() * 60) + 12
    const b = Math.floor(Math.random() * 50) + 9
    prompt = `${a} + ${b} = ?`
    correct = a + b
  } else if (type === "sub") {
    const a = Math.floor(Math.random() * 80) + 30
    const b = Math.floor(Math.random() * (a - 10)) + 5
    prompt = `${a} - ${b} = ?`
    correct = a - b
  } else if (type === "mul") {
    const a = Math.floor(Math.random() * 11) + 3
    const b = Math.floor(Math.random() * 12) + 4
    prompt = `${a} × ${b} = ?`
    correct = a * b
  } else if (type === "div") {
    const b = Math.floor(Math.random() * 8) + 2
    const quot = Math.floor(Math.random() * 15) + 3
    const a = b * quot
    prompt = `${a} ÷ ${b} = ?`
    correct = quot
  } else {
    // Logistics context
    const packages = Math.floor(Math.random() * 6) + 2
    const kgEach = Math.floor(Math.random() * 9) + 3
    prompt = `${packages} caixas × ${kgEach} kg = ?`
    correct = packages * kgEach
  }

  // Generate 4 options
  const setOpts = new Set<number>([correct])
  while (setOpts.size < 4) {
    const delta = (Math.floor(Math.random() * 7) + 1) * (Math.random() > 0.5 ? 1 : -1)
    const fake = Math.max(1, correct + delta)
    setOpts.add(fake)
  }

  const options = Array.from(setOpts).sort(() => Math.random() - 0.5)
  return { prompt, correct, options }
}

export function SpeedMathGame({
  onComplete,
}: {
  onComplete: (event: GameCompletionEvent) => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [currentQ, setCurrentQ] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [isGameOver, setIsGameOver] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startGame = () => {
    setIsPlaying(true)
    setIsGameOver(false)
    setTimeLeft(60)
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setCorrectCount(0)
    setFeedback(null)
    setCurrentQ(generateQuestion())
  }

  useEffect(() => {
    if (!isPlaying) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          endGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying])

  const endGame = useCallback(() => {
    setIsPlaying(false)
    setIsGameOver(true)
    playSuccessChime()

    onComplete({
      gameId: "speed_math",
      score,
      level: Math.floor(correctCount / 5) + 1,
      timeMs: 60000,
      moves: correctCount,
      metadata: {
        maxStreak,
        correctAnswers: correctCount,
      },
    })
  }, [score, correctCount, maxStreak, onComplete])

  const handleAnswer = (chosen: number) => {
    if (!isPlaying || !currentQ) return

    if (chosen === currentQ.correct) {
      // Correct!
      const newStreak = streak + 1
      const multiplier = Math.min(5, 1 + Math.floor(newStreak / 3))
      const pts = 100 * multiplier
      setScore(s => s + pts)
      setStreak(newStreak)
      if (newStreak > maxStreak) setMaxStreak(newStreak)
      setCorrectCount(c => c + 1)
      setFeedback("correct")
      playStepSound(newStreak)
    } else {
      // Wrong!
      setStreak(0)
      setFeedback("wrong")
      playErrorBuzz()
    }

    setTimeout(() => {
      setFeedback(null)
      setCurrentQ(generateQuestion())
    }, 180)
  }

  const multiplier = Math.min(5, 1 + Math.floor(streak / 3))

  return (
    <div className="flex flex-col items-center select-none">
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--border-subtle)] shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 60 Segundos de Reflexo
          </div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            Pontos: <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{score} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {streak >= 3 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold animate-bounce">
              <Flame className="w-3.5 h-3.5 fill-amber-500" />
              {multiplier}x Combo ({streak})
            </div>
          )}

          <div className="text-right">
            <span className="text-[11px] text-[var(--text-tertiary)] block">Tempo</span>
            <span className={`text-[14px] font-mono font-extrabold ${timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-[var(--text-primary)]"}`}>
              {timeLeft}s
            </span>
          </div>

          <button
            onClick={startGame}
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
                Responda ao maior número de contas logísticas em 60 segundos. Manter a sequência aumenta o multiplicador!
              </p>
            </div>
            <button
              onClick={startGame}
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
            <button
              onClick={startGame}
              className="mt-3 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-transform active:scale-95"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Question prompt */}
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-wide py-3 px-6 rounded-2xl transition-all ${
                feedback === "correct"
                  ? "bg-emerald-500/10 text-emerald-600 scale-105"
                  : feedback === "wrong"
                  ? "bg-rose-500/10 text-rose-600 scale-95"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {currentQ?.prompt}
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {currentQ?.options.map((opt, i) => (
                <button
                  key={i}
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

