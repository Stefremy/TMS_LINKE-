'use client'

import { useRef, useState } from 'react'
import { Mail, Copy, Check } from 'lucide-react'

const email = 'geral@linke.pt'

export function SuspensionContact() {
  const emailRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle')

  async function copyEmail() {
    if (status === 'copying') return
    setStatus('copying')
    try {
      await navigator.clipboard.writeText(email)
      setStatus('copied')
    } catch {
      emailRef.current?.focus()
      emailRef.current?.select()
      setStatus('manual')
    }
  }

  return <div className="mt-7">
    <a href={`mailto:${email}?subject=Reativar%20conta%20de%20cliente`} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#246b45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d5839] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#246b45]"><Mail className="h-4 w-4" aria-hidden="true" />Contactar {email}</a>
    <p className="mt-4 text-xs leading-5 text-[#59665f]">Não abriu a aplicação de email? Copie o endereço e escreva-nos pelo serviço de email que utiliza.</p>
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#dde3df] bg-[#f8faf9] p-2">
      <input ref={emailRef} aria-label="Endereço de email de apoio" readOnly value={email} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-[#202925] outline-offset-2" />
      <button type="button" onClick={copyEmail} disabled={status === 'copying'} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3df] bg-white px-3 py-2 text-xs font-semibold text-[#246b45] hover:bg-[#eef3f0] disabled:opacity-60">{status === 'copied' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{status === 'copied' ? 'Copiado' : 'Copiar email'}</button>
    </div>
    <p role="status" className="mt-2 text-xs leading-5 text-[#59665f]">{status === 'copied' ? 'Email copiado. Cole-o no destinatário de uma nova mensagem.' : status === 'manual' ? 'O endereço está selecionado. Use a opção Copiar do dispositivo e cole-o numa nova mensagem.' : ''}</p>
  </div>
}
