"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react"

export function ClientPasswordForm() {
  const captured = useRef(false)
  const [token, setToken] = useState<{ token_hash: string; type: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  /* eslint-disable react-hooks/set-state-in-effect -- Capture browser-only URL state once after hydration. */
  useEffect(() => {
    if (captured.current) return
    captured.current = true
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const hash = fragment.get("token_hash")
    const type = fragment.get("type")
    // Keep the token only in memory; remove it before the user navigates elsewhere.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname)
    if (hash && /^[a-f0-9]{40,128}$/i.test(hash) && (type === "invite" || type === "recovery")) setToken({ token_hash: hash, type })
    setReady(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || pending) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") || "")
    const confirmation = String(form.get("confirmation") || "")
    if (password !== confirmation) { setError("As duas palavras-passe devem ser iguais."); return }
    setError("")
    setPending(true)
    try {
      const response = await fetch("/api/auth/client-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...token, password, confirmation }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Não foi possível definir a palavra-passe.")
      setToken(null)
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir. Tente novamente.")
    } finally { setPending(false) }
  }

  const inputClass = "w-full rounded-xl border border-[#d8e3da] bg-[#fcfdfb] px-4 py-3 text-base outline-none focus:border-[#126b4a] focus:ring-2 focus:ring-emerald-100"
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#f3f6f2] px-5 py-10 text-[#1a3028]">
      <Image src="/Linke-logo.png" alt="Linke" width={115} height={35} style={{ width: 115, height: "auto" }} preload />
      <section aria-labelledby="password-title" className="my-10 w-full max-w-md rounded-3xl border border-[#e0e8df] bg-white p-7 shadow-[0_18px_65px_rgba(30,65,44,0.06)] sm:p-10">
        {success ? <>
          <CheckCircle2 className="mb-5 h-10 w-10 text-[#126b4a]" />
          <h1 id="password-title" className="text-2xl font-semibold">Palavra-passe definida</h1>
          <p className="my-5 text-sm leading-6 text-[#64756a]">Já pode entrar na sua loja com o email do convite e a palavra-passe que escolheu.</p>
          <Link href="/app/login" className="block rounded-xl bg-[#126b4a] px-5 py-3.5 text-center text-sm font-semibold text-white">Entrar na minha loja</Link>
        </> : <>
          <LockKeyhole className="mb-5 h-8 w-8 text-[#126b4a]" />
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#497761]">Área do Cliente</p>
          <h1 id="password-title" className="text-2xl font-semibold">Escolha a sua palavra-passe</h1>
          <p className="mb-6 mt-3 text-sm leading-6 text-[#64756a]">Só precisa de a definir uma vez. Depois, utilize-a para entrar e preparar os envios da sua loja.</p>
          {ready && !token && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Abra esta página pelo botão do email de convite. Se o link expirou, peça um novo à equipa Linke.</p>}
          {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <form onSubmit={submit} className="space-y-5">
            <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium">Nova palavra-passe</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={inputClass} /><p className="mt-2 text-xs text-[#64756a]">Pelo menos 12 caracteres. Pode usar uma frase fácil de recordar.</p></div>
            <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Repetir palavra-passe</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className={inputClass} /></div>
            <button type="submit" disabled={!token || pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#126b4a] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#0d553a] disabled:opacity-50">{pending ? <><Loader2 className="h-4 w-4 animate-spin" />A guardar…</> : "Guardar palavra-passe"}</button>
          </form>
        </>}
      </section>
      <p className="text-xs text-[#7b8a80]">Linke · Portal do Cliente</p>
    </main>
  )
}
