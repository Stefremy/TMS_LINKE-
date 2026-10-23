'use client'

import * as React from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useClientScope } from './ClientScope'
import { type MessagePage } from '@/lib/client-messages/types'

const MessagesContext = React.createContext<{ count: number; refresh: () => Promise<void> } | null>(null)
export function ClientMessagesProvider({ children }: { children: React.ReactNode }) {
  const { client } = useClientScope()
  const [counter, setCounter] = React.useState({ client: client.id, count: 0 })
  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/client-messages?clientId=${encodeURIComponent(client.id)}&summary=1`, { cache: 'no-store', signal })
      if (!response.ok) return
      const data: MessagePage = await response.json()
      if (!signal?.aborted) setCounter({ client: client.id, count: data.unreadCount })
    } catch { /* The inbox reports errors when opened; navigation stays available. */ }
  }, [client.id])
  React.useEffect(() => {
    const controller = new AbortController()
    const initial = setTimeout(() => { void refresh(controller.signal) }, 1500)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(controller.signal) }
    const interval = setInterval(onVisible, 90000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { controller.abort(); clearTimeout(initial); clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])
  return <MessagesContext.Provider value={{ count: counter.client === client.id ? counter.count : 0, refresh }}>{children}</MessagesContext.Provider>
}
export function ClientMessageBell() {
  const { basePath } = useClientScope()
  const count = React.useContext(MessagesContext)?.count || 0
  return <Link href={`${basePath}/mensagens`} prefetch={false} aria-label={count ? `Mensagens: ${count} por ler` : 'Mensagens'} title="Mensagens"
    className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] sm:h-9 sm:w-9">
    <Bell aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />
    {count > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-[#155EEF] px-1 text-center text-[9px] font-semibold leading-4 text-white">{count > 99 ? '99+' : count}</span>}
  </Link>
}

export function useClientMessageCounter() { return React.useContext(MessagesContext) }
