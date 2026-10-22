import type { Metadata } from 'next'
import Image from 'next/image'
import { LockKeyhole, Mail, ArrowLeft } from 'lucide-react'
import { signout } from '@/app/login/actions'

export const metadata: Metadata = { title: 'Conta suspensa | Linke', robots: { index: false, follow: false } }

export default function SuspendedAccountPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f2f4f3] px-5 py-8 text-[#202925]">
      <header className="mx-auto w-full max-w-6xl">
        <Image src="/Linke-logo.png" alt="Linke" width={115} height={35} style={{ width: 115, height: 'auto' }} priority />
      </header>
      <div className="flex flex-1 items-center justify-center py-12">
        <section aria-labelledby="suspension-title" className="w-full max-w-lg rounded-2xl border border-[#dde3df] bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#a83b36] text-white"><LockKeyhole className="h-6 w-6" aria-hidden="true" /></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#68756e]">Área do Cliente</p>
          <h1 id="suspension-title" className="text-3xl font-semibold tracking-tight">A sua conta foi suspensa</h1>
          <p className="mt-4 text-sm leading-7 text-[#59665f]">O acesso à sua Área do Cliente está temporariamente bloqueado. Para reativar a conta, contacte a nossa equipa.</p>
          <a href="mailto:geral@linke.pt?subject=Reativar%20conta%20de%20cliente" className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-[#246b45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d5839] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#246b45]"><Mail className="h-4 w-4" aria-hidden="true" />Contactar geral@linke.pt</a>
          <form action={signout} className="mt-5 text-center"><button className="inline-flex items-center gap-2 text-sm text-[#59665f] underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Sair da conta</button></form>
        </section>
      </div>
      <p className="text-center text-xs text-[#7b8780]">Linke · Apoio ao cliente</p>
    </main>
  )
}
