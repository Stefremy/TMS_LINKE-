'use client'
import { useEffect, useState } from 'react'
import { AlertCircle, Info, Pause, Play } from 'lucide-react'
import { useClientScope } from './ClientScope'
import { announcementIsVisible, type ClientAnnouncement } from '@/lib/client-messages/announcements'

export function ClientAnnouncements() {
  const { client } = useClientScope()
  const [notices, setNotices] = useState<ClientAnnouncement[]>([])
  const [paused, setPaused] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    async function load() {
      if (busy || controller.signal.aborted || document.visibilityState === 'hidden') return
      busy = true
      try {
        const response = await fetch(`/api/client-announcements?clientId=${encodeURIComponent(client.id)}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) {
          if (!controller.signal.aborted && [401, 403].includes(response.status)) setNotices([])
          return
        }
        const data: { notices: ClientAnnouncement[] } = await response.json()
        if (!controller.signal.aborted) { setNow(Date.now()); setNotices((data.notices || []).filter(notice => announcementIsVisible(notice, client.id))) }
      } catch { /* Keep an already displayed notice during a temporary network outage. */ }
      finally { busy = false; if (!controller.signal.aborted) setNotices(previous => previous.filter(notice => announcementIsVisible(notice, client.id))) }
    }
    void load()
    const timer = setInterval(() => { void load() }, 60000)
    document.addEventListener('visibilitychange', load)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load) }
  }, [client.id])
  useEffect(() => {
    const expiries = notices.flatMap(notice => notice.expiresAt ? [Date.parse(notice.expiresAt)] : []).filter(Number.isFinite)
    if (!expiries.length) return
    const timer = setTimeout(() => {
      setNow(Date.now())
      setNotices(previous => previous.filter(notice => announcementIsVisible(notice, client.id)))
    }, Math.min(2147483647, Math.max(0, Math.min(...expiries) - Date.now())))
    return () => clearTimeout(timer)
  }, [notices, client.id])
  if (!notices.length) return null
  return <aside aria-label="Comunicados Linke" className="relative z-10 shrink-0 border-b border-[var(--border-subtle)]">
    {notices.filter(notice => announcementIsVisible(notice, client.id, now)).map(notice => <div key={notice.id}
      data-paused={paused}
      className={`client-announcement flex min-w-0 items-center gap-3 px-4 py-2 text-xs ${notice.level === 'warning' ? 'bg-[#faf1db] text-[#725a35]' : 'bg-[#edf4ef] text-[#3e5845]'}`}>
      {notice.level === 'warning' ? <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Info aria-hidden="true" className="h-4 w-4 shrink-0" />}
      <p role="status" className="sr-only">{notice.title} — {notice.body}</p>
      <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true">
        <div className="client-announcement-track" style={{ animationPlayState: paused ? 'paused' : undefined, animationDuration: `${Math.max(30, (notice.title.length + notice.body.length) * 0.15)}s` }}>
          {[0, 1].map(copy => <span key={copy} className="client-announcement-copy"><strong>{notice.title}</strong> — {notice.body.replace(/\s+/g, ' ')}</span>)}
        </div>
      </div>
      <button type="button" aria-label={paused ? 'Retomar texto dos comunicados' : 'Pausar texto dos comunicados'} aria-pressed={paused}
        onClick={() => setPaused(value => !value)} className="rounded p-1 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current">
        {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
      </button>
    </div>)}
  </aside>
}
