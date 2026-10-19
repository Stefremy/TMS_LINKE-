"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Hash, LockKeyhole, MessageSquare, RefreshCw, Search, Send, Users } from "lucide-react"
import { CHAT_MAX_LENGTH, mergeChatMessages, type ChatMember, type ChatPage } from "@/lib/team-chat"
import styles from "./TeamChat.module.css"

function Avatar({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return <span className={styles.avatar} aria-hidden="true">{url && failedUrl !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
  ) : name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>
}
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon" }).format(new Date(value))
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(value))

export function TeamChatClient({ initial, initialError }: { initial: ChatPage; initialError: string | null }) {
  const [recipient, setRecipient] = useState<string | null>(null)
  const [members, setMembers] = useState(initial.members)
  const [messages, setMessages] = useState(initial.messages)
  const [hasOlder, setHasOlder] = useState(initial.hasMore)
  const [error, setError] = useState(initialError)
  const [ready, setReady] = useState(!initialError)
  const [blocked, setBlocked] = useState(false)
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [retry, setRetry] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  const latest = useRef(initial.messages.at(-1)?.sequence || 0)
  const initialized = useRef(!initialError)
  const firstEffect = useRef(true)
  const stickBottom = useRef(true)
  const pending = useRef<{ key: string; body: string; id: string } | null>(null)
  const key = recipient || "general"
  const draft = drafts[key] || ""
  const peer = members.find(member => member.user_id === recipient)
  const me = members.find(member => member.user_id === initial.viewerId)

  const endpoint = useCallback((extra = "") => `/api/ops/chat?viewer=${initial.viewerId}${recipient ? `&recipient=${recipient}` : ""}${extra}`, [initial.viewerId, recipient])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let running = false
    const first = firstEffect.current
    firstEffect.current = false
    if (!first) initialized.current = false
    async function update() {
      if (running || controller.signal.aborted || document.visibilityState === "hidden") return
      running = true
      try {
        let more = true, pages = 0
        // Re-read a small overlap, then drain forwards without skipping a busy interval.
        let cursor = initialized.current && latest.current ? Math.max(1, latest.current - 100) : 0
        while (more && pages++ < 10) {
          const incremental = initialized.current
          const after = cursor ? `&after=${cursor}` : ""
          const response = await fetch(endpoint(after), { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
          const data = await response.json()
          if (controller.signal.aborted) return
          if (!response.ok) {
            if ([401, 403, 409].includes(response.status)) setBlocked(true)
            throw new Error(data.error || "Não foi possível atualizar a conversa.")
          }
          if (data.viewerId !== initial.viewerId) { setBlocked(true); throw new Error("A sessão mudou. Atualize a página.") }
          const page = data as ChatPage
          setMembers(page.members)
          setMessages(previous => incremental ? mergeChatMessages(previous, page.messages) : page.messages)
          if (!incremental || !latest.current) setHasOlder(page.hasMore)
          latest.current = Math.max(latest.current, page.messages.at(-1)?.sequence || 0)
          initialized.current = true
          setReady(true)
          setError(null)
          const nextCursor = page.messages.at(-1)?.sequence || cursor
          more = !!after && page.hasMore && nextCursor > cursor
          cursor = nextCursor
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Ligação interrompida. Vamos tentar novamente.")
      } finally { running = false }
    }
    function schedule() { timer = setTimeout(async () => { await update(); if (!controller.signal.aborted) schedule() }, 5000) }
    queueMicrotask(() => { void update(); schedule() })
    const onVisible = () => { if (document.visibilityState === "visible") void update() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [endpoint, initial.viewerId, retry])

  useEffect(() => {
    if (stickBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [messages, recipient])

  function selectConversation(value: string | null) {
    if (sending || olderLoading || value === recipient) return
    setRecipient(value); setMessages([]); setHasOlder(false); setReady(false); setError(null)
    latest.current = 0; initialized.current = false; stickBottom.current = true
  }

  async function loadOlder() {
    if (!messages.length || olderLoading) return
    setOlderLoading(true)
    const selected = key
    try {
      const response = await fetch(endpoint(`&before=${messages[0].sequence}`), { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.")
      if (selected !== (recipient || "general")) return
      const element = scroll.current
      const previousHeight = element?.scrollHeight || 0
      stickBottom.current = false
      setMessages(previous => mergeChatMessages(previous, data.messages)); setHasOlder(data.hasMore)
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - previousHeight })
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar o histórico.") }
    finally { setOlderLoading(false) }
  }

  async function send() {
    const body = draft.trim()
    if (!body || sending || !ready || blocked) return
    setSending(true); setError(null)
    if (pending.current?.key !== key || pending.current?.body !== body) pending.current = { key, body, id: crypto.randomUUID() }
    try {
      const response = await fetch("/api/ops/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ viewerId: initial.viewerId, recipient, body, clientMessageId: pending.current.id }),
      })
      const data = await response.json()
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) setBlocked(true)
        throw new Error(data.error || "A mensagem não foi enviada.")
      }
      stickBottom.current = true
      setMessages(previous => mergeChatMessages(previous, [data.message]))
      setDrafts(previous => ({ ...previous, [key]: "" }))
      pending.current = null
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar o envio. O texto foi mantido; pode tentar novamente.") }
    finally { setSending(false) }
  }

  const colleagues = members.filter(member => member.user_id !== initial.viewerId && member.name.toLocaleLowerCase("pt").includes(search.toLocaleLowerCase("pt")))
  return <div className="relative p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
    <div className={styles.heading}><div><h1>Chat da equipa</h1><p>Uma sala para todos. Uma conversa para cada colega.</p></div><span><Users size={15} /> Interno · OPS</span></div>
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Conversas">
        <button type="button" className={`${styles.conversation} ${!recipient ? styles.selected : ""}`} onClick={() => selectConversation(null)} disabled={sending} aria-pressed={!recipient}>
          <span className={styles.generalIcon}><Hash size={20} /></span><span><strong>Sala geral</strong><small>Toda a equipa</small></span>
        </button>
        <label className={styles.search}><Search size={16} /><input aria-label="Procurar colega" placeholder="Procurar colega" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <p className={styles.sectionLabel}>CONVERSAS PRIVADAS</p>
        <div className={styles.colleagues}>{colleagues.map((member: ChatMember) => <button type="button" key={member.user_id} className={`${styles.conversation} ${recipient === member.user_id ? styles.selected : ""}`} disabled={sending || olderLoading} onClick={() => selectConversation(member.user_id)} aria-pressed={recipient === member.user_id}>
          <Avatar name={member.name} url={member.avatar_url} /><span><strong>{member.name}</strong><small>Conversa privada</small></span>
        </button>)}</div>
        {!colleagues.length && <p className={styles.directoryNote}>{search ? "Nenhum colega encontrado." : "Os colegas aparecem aqui depois de abrirem o chat pela primeira vez."}</p>}
        <div className={styles.myProfile}>{me && <Avatar name={me.name} url={me.avatar_url} />}<span><strong>{me?.name || "A tua conta"}</strong><small>Sessão iniciada</small></span></div>
      </aside>
      <section className={styles.thread} aria-label={recipient ? `Conversa com ${peer?.name || "colega"}` : "Sala geral"}>
        <div className={styles.threadHeader}><div className={styles.threadTitle}>{recipient ? <LockKeyhole size={20} /> : <Hash size={22} />}<div><h2>{recipient ? peer?.name || "Conversa privada" : "Sala geral"}</h2><p>{recipient ? "Visível apenas aos dois participantes" : "Mensagens partilhadas com toda a equipa"}</p></div></div>
          <button type="button" className={styles.refresh} aria-label="Atualizar conversa" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} /></button>
        </div>
        {error && <div className={styles.error} role="alert">{error}{blocked && " Volte a iniciar sessão se necessário."}</div>}
        <div className={styles.messages} ref={scroll} onScroll={event => { const node = event.currentTarget; stickBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }} role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions">
          {hasOlder && <button type="button" className={styles.older} onClick={loadOlder} disabled={olderLoading}>{olderLoading ? "A carregar…" : "Ver mensagens anteriores"}</button>}
          {!ready && !error && <p className={styles.loading} role="status">A abrir conversa…</p>}
          {ready && !messages.length && <div className={styles.empty}><MessageSquare size={32} strokeWidth={1.5} /><h3>{recipient ? "Começa a conversa" : "Bem-vindos à sala geral"}</h3><p>{recipient ? `Escreve uma mensagem a ${peer?.name || "este colega"}.` : "Partilha novidades, combina tarefas e mantém a equipa a par."}</p></div>}
          {messages.map((message, index) => {
            const own = message.sender_id === initial.viewerId
            const showDate = !index || dateLabel(messages[index - 1].created_at) !== dateLabel(message.created_at)
            return <div key={message.id}>{showDate && <div className={styles.day}>{dateLabel(message.created_at)}</div>}
              <article className={`${styles.message} ${own ? styles.own : ""}`}>
                {!own && <Avatar name={message.sender_name} url={message.sender_avatar_url} />}
                <div className={styles.bubble}><div className={styles.messageMeta}><strong>{own ? `${message.sender_name} (tu)` : message.sender_name}</strong><time dateTime={message.created_at} title={dateLabel(message.created_at)}>{timeLabel(message.created_at)}</time></div><p>{message.body}</p></div>
              </article>
            </div>
          })}
        </div>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send() }}>
          <label className="sr-only" htmlFor="team-chat-message">Mensagem</label>
          <textarea id="team-chat-message" placeholder={recipient ? `Mensagem para ${peer?.name || "colega"}…` : "Escreve para a equipa…"} rows={2} maxLength={CHAT_MAX_LENGTH} value={draft} disabled={!ready || blocked || sending} onChange={event => setDrafts(previous => ({ ...previous, [key]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} />
          <div className={styles.composerFooter}><small><span className={styles.keyboardHint}>Enter para enviar · Shift + Enter para nova linha · </span>{draft.length}/{CHAT_MAX_LENGTH}</small><button type="submit" disabled={!ready || blocked || sending || !draft.trim()}><Send size={16} />{sending ? "A enviar…" : "Enviar"}</button></div>
        </form>
      </section>
    </div>
  </div>
}
