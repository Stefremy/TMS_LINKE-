"use client"

import Image from "next/image"
import { ArrowRight, AlertCircle, Loader2, Package, Truck, MapPin } from "lucide-react"
import { useFormStatus } from "react-dom"
import { clientLogin } from "@/app/login/actions"

function ClientSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#126b4a] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0d553a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60">
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" />A entrar…</> : <>Entrar na minha loja<ArrowRight className="h-4 w-4" /></>}
    </button>
  )
}

export function ClientLoginForm({ returnTo, isError }: { returnTo?: string; isError: boolean }) {
  return (
    <main className="min-h-screen bg-[#f3f6f2] px-5 py-8 font-sans text-[#1a3028] sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Image src="/Linke-logo.png" alt="Linke" width={115} height={35} style={{ width: 115, height: "auto" }} preload />
        <a href="mailto:suporte@linke.pt" className="text-sm font-medium text-[#426355] underline-offset-4 hover:underline">Precisa de ajuda?</a>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <section className="hidden lg:block">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#497761]">Portal de expedições Linke</p>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">A sua loja.<br />Os seus envios.<br /><span className="text-[#126b4a]">Tudo num só lugar.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#5a6d62]">Prepare as suas encomendas, acompanhe as entregas e consulte os documentos da sua conta.</p>
          <div className="mt-9 grid max-w-md gap-4 text-sm sm:grid-cols-3">
            {[{ icon: Package, label: "Criar envios" }, { icon: Truck, label: "Acompanhar entregas" }, { icon: MapPin, label: "Guardar destinatários" }].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dbe5dc] bg-white"><Icon className="h-5 w-5 text-[#126b4a]" /></span>
                <span className="leading-5 text-[#426355]">{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="client-login-title" className="rounded-3xl border border-[#e0e8df] bg-white p-7 shadow-[0_18px_65px_rgba(30,65,44,0.06)] sm:p-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#497761]">Bem-vindo à sua conta</p>
          <h2 id="client-login-title" className="text-2xl font-semibold tracking-tight">Área do Cliente</h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-[#64756a]">Utilize o email e a password de acesso à sua loja.</p>
          {isError && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Não foi possível entrar. Verifique as credenciais ou contacte o suporte.</span></div>}
          <form action={clientLogin} className="space-y-5">
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <div>
              <label htmlFor="client-email" className="mb-2 block text-sm font-medium">Email de acesso</label>
              <input id="client-email" name="email" type="email" autoComplete="username" required placeholder="nome@loja.pt" className="w-full rounded-xl border border-[#d8e3da] bg-[#fcfdfb] px-4 py-3 text-base outline-none transition placeholder:text-[#9aa99e] focus:border-[#126b4a] focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div>
              <label htmlFor="client-password" className="mb-2 block text-sm font-medium">Password</label>
              <input id="client-password" name="password" type="password" autoComplete="current-password" required placeholder="A sua password" className="w-full rounded-xl border border-[#d8e3da] bg-[#fcfdfb] px-4 py-3 text-base outline-none transition placeholder:text-[#9aa99e] focus:border-[#126b4a] focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="pt-2"><ClientSubmitButton /></div>
          </form>
          <p className="mt-6 border-t border-[#edf1eb] pt-5 text-xs leading-5 text-[#7b8a80]">Recebeu um convite? Abra o botão do email para escolher a sua palavra-passe. Se ainda não tem acesso, contacte a equipa Linke.</p>
        </section>
      </div>
      <footer className="mx-auto max-w-6xl text-xs text-[#7b8a80]">© {new Date().getFullYear()} Linke · Portal do Cliente</footer>
    </main>
  )
}
