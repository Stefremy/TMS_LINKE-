/**
 * Zero-dependency Web Audio synthesizers for brain games.
 * Gracefully silent if audio context is blocked or muted.
 */

let audioCtx: AudioContext | null = null
let isMuted = false

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (isMuted) return null
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass()
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

export function setSoundMuted(muted: boolean) {
  isMuted = muted
}

export function isSoundMuted(): boolean {
  return isMuted
}

export function playNote(freq: number, durationSec: number = 0.1, type: OscillatorType = "sine", gainVal: number = 0.15) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(gainVal, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durationSec)
  } catch {}
}

export function playConnectSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(523.25, t) // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.1) // E5
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(t + 0.15)
  } catch {}
}

export function playStepSound(index: number = 0) {
  const baseFreq = 440
  const freq = baseFreq * Math.pow(2, (index % 12) / 12)
  playNote(freq, 0.08, "triangle", 0.12)
}

export function playSuccessChime() {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playNote(freq, 0.25, "sine", 0.2)
    }, idx * 90)
  })
}

export function playErrorBuzz() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.setValueAtTime(110, t + 0.08)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(t + 0.2)
  } catch {}
}

