'use client'

import Image from 'next/image'
import { login } from './actions'
import { ArrowRight, AlertTriangle, Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex items-center justify-between w-[200px] py-3.5 px-6 rounded bg-[var(--accent)] hover:bg-[#10733B] text-white text-[15px] font-bold transition-all hover:pr-5 shadow-lg shadow-[rgba(18,138,71,0.25)] disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{pending ? 'A entrar...' : 'Login Seguro'}</span>
      {pending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      )}
    </button>
  )
}

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginFormContent() {
  const searchParams = useSearchParams()
  const isError = searchParams.get('error') === 'true'
  return (
    <div className="min-h-screen flex bg-white font-sans text-slate-900">
      
      {/* Left Column - Login Form */}
      <div className="w-full lg:w-5/12 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative z-10">
        
        {/* Brand / Logo */}
        <div className="absolute top-8 left-8 sm:left-16 md:left-24 xl:left-32">
          <Image 
            src="/Linke-logo.png" 
            alt="Linke Logo" 
            width={140} 
            height={36} 
            className="object-contain" 
            style={{ height: "auto" }}
            preload
          />
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0 mt-16 lg:mt-0">
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-slate-800 leading-tight mb-2">
            Logistics<br />
            <span className="font-semibold text-slate-900">Management</span>
          </h1>
          <p className="text-slate-500 text-sm mb-10">
            Aceda à sua conta para gerir as suas operações de transporte e logística.
          </p>

          {isError && (
            <div className="bg-red-50 text-red-600 text-[13px] p-3 rounded-md mb-6 border border-red-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>As credenciais introduzidas estão incorretas. Por favor, tente novamente.</span>
            </div>
          )}

          <form action={login} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest" htmlFor="email">
                Email Corporativo
              </label>
              <input
                className="w-full px-0 py-2 bg-transparent border-b-2 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-[var(--accent)] transition-colors text-base"
                id="email"
                name="email"
                type="email"
                required
                placeholder="nome@empresa.pt"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest" htmlFor="password">
                Password
              </label>
              <input
                className="w-full px-0 py-2 bg-transparent border-b-2 border-slate-200 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-[var(--accent)] transition-colors text-base"
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>

            <div className="pt-4">
              <SubmitButton />
            </div>
          </form>
          
          <div className="mt-16 text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>© 2026 Linke TMS. Todos os direitos reservados.</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Suporte</a>
          </div>
        </div>
      </div>

      {/* Decorative illustration rendered as HTML/CSS, without a full-screen image request. */}
      <div className="hidden lg:flex w-7/12 relative items-center justify-center overflow-hidden border-l border-slate-100 bg-[linear-gradient(135deg,#f1fff5_0%,#e6f8ed_48%,#e8f1ff_100%)]" aria-hidden="true">
        <div className="absolute -top-48 -right-32 h-[680px] w-[680px] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-52 -left-24 h-[650px] w-[650px] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative flex h-[min(65vw,620px)] w-[min(65vw,620px)] items-center justify-center rounded-full border border-emerald-300/60 bg-white/20 shadow-[0_30px_100px_rgba(13,148,136,0.12)] rotate-[-25deg]">
          <div className="flex h-[78%] w-[78%] items-center justify-center rounded-full border-[35px] border-emerald-400/30 shadow-[inset_0_0_70px_rgba(16,185,129,0.1)]">
            <div className="flex h-[73%] w-[73%] items-center justify-center rounded-full border-[42px] border-emerald-500/50 bg-white/30">
              <div className="h-[65%] w-[65%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e2fff0,#34d399_75%,#10b981)] shadow-[0_24px_65px_rgba(5,150,105,0.25)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  )
}
