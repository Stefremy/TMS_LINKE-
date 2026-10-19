"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Film, Hash, LockKeyhole, MessageSquare, Plus, RefreshCw, Search, Send, Smile, Users, X } from "lucide-react"
import { CHAT_MAX_LENGTH, DEFAULT_CHANNELS, mergeChatMessages, type ChatChannel, type ChatMember, type ChatPage } from "@/lib/team-chat"
import { CURATED_GIFS, EMOJI_CATEGORIES, isOnlyEmojis, parseGifMessage, type GifItem } from "@/lib/team-chat-media"
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
  const [channels, setChannels] = useState<ChatChannel[]>(initial.channels?.length ? initial.channels : DEFAULT_CHANNELS)
  const [activeChannel, setActiveChannel] = useState<string>(initial.activeChannel || "geral")
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

  // Modal para criar novo canal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [channelError, setChannelError] = useState<string | null>(null)

  // Emojis e GIFs
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState<string>(EMOJI_CATEGORIES[0].name)
  const [emojiSearch, setEmojiSearch] = useState("")
  const [gifCategory, setGifCategory] = useState<string>("Tudo")
  const [gifSearch, setGifSearch] = useState("")

  const scroll = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPopoverRef = useRef<HTMLDivElement>(null)
  const gifPopoverRef = useRef<HTMLDivElement>(null)
  const latest = useRef(initial.messages.at(-1)?.sequence || 0)
  const initialized = useRef(!initialError)
  const firstEffect = useRef(true)
  const stickBottom = useRef(true)
  const pending = useRef<{ key: string; body: string; id: string } | null>(null)

  const key = recipient ? `dm_${recipient}` : `ch_${activeChannel || "geral"}`
  const draft = drafts[key] || ""
  const peer = members.find(member => member.user_id === recipient)
  const me = members.find(member => member.user_id === initial.viewerId)
  const currentChannel = channels.find(c => c.slug === activeChannel) || channels[0] || { name: "Sala geral", description: "Toda a equipa", slug: "geral" }

  const endpoint = useCallback((extra = "") => {
    const target = recipient ? `&recipient=${recipient}` : `&channel=${encodeURIComponent(activeChannel || "geral")}`
    return `/api/ops/chat?viewer=${initial.viewerId}${target}${extra}`
  }, [initial.viewerId, recipient, activeChannel])

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
          if (page.channels && Array.isArray(page.channels)) {
            setChannels(page.channels)
          }
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
  }, [messages, recipient, activeChannel])

  function selectChannel(slug: string) {
    if (sending || olderLoading || (!recipient && activeChannel === slug)) return
    setRecipient(null)
    setActiveChannel(slug)
    setMessages([])
    setHasOlder(false)
    setReady(false)
    setError(null)
    latest.current = 0
    initialized.current = false
    stickBottom.current = true
  }

  function selectConversation(value: string | null) {
    if (sending || olderLoading || value === recipient) return
    setRecipient(value)
    setMessages([])
    setHasOlder(false)
    setReady(false)
    setError(null)
    latest.current = 0
    initialized.current = false
    stickBottom.current = true
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim() || creatingChannel) return
    setCreatingChannel(true)
    setChannelError(null)
    try {
      const response = await fetch("/api/ops/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChannelName.trim(), description: newChannelDesc.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o canal.")
      const created: ChatChannel = data.channel
      setChannels(prev => [...prev.filter(c => c.slug !== created.slug), created])
      setShowCreateModal(false)
      setNewChannelName("")
      setNewChannelDesc("")
      selectChannel(created.slug)
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : "Erro ao criar canal.")
    } finally {
      setCreatingChannel(false)
    }
  }

  async function loadOlder() {
    if (!messages.length || olderLoading) return
    setOlderLoading(true)
    const selectedKey = key
    try {
      const response = await fetch(endpoint(`&before=${messages[0].sequence}`), { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.")
      if (selectedKey !== key) return
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          viewerId: initial.viewerId,
          recipient,
          channel: recipient ? null : (activeChannel || "geral"),
          body,
          clientMessageId: pending.current.id,
        }),
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

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest?.(`.${styles.composerTools}`)) return

      if (showEmojiPicker && emojiPopoverRef.current && !emojiPopoverRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }
      if (showGifPicker && gifPopoverRef.current && !gifPopoverRef.current.contains(target)) {
        setShowGifPicker(false)
      }
    }
    if (showEmojiPicker || showGifPicker) {
      document.addEventListener("mousedown", handleOutside)
      return () => document.removeEventListener("mousedown", handleOutside)
    }
  }, [showEmojiPicker, showGifPicker])

  function handleSelectEmoji(char: string) {
    const current = draft
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart ?? current.length
      const end = textarea.selectionEnd ?? current.length
      const next = current.slice(0, start) + char + current.slice(end)
      setDrafts(prev => ({ ...prev, [key]: next }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + char.length, start + char.length)
      }, 0)
    } else {
      setDrafts(prev => ({ ...prev, [key]: current + char }))
    }
  }

  async function handleSendGif(gif: GifItem) {
    setShowGifPicker(false)
    if (sending || !ready || blocked) return
    const gifBody = `[gif:${gif.url}]`
    setSending(true)
    setError(null)
    const clientMessageId = crypto.randomUUID()
    try {
      const response = await fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          viewerId: initial.viewerId,
          recipient,
          channel: recipient ? null : (activeChannel || "geral"),
          body: gifBody,
          clientMessageId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) setBlocked(true)
        throw new Error(data.error || "O GIF não foi enviado.")
      }
      stickBottom.current = true
      setMessages(previous => mergeChatMessages(previous, [data.message]))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar o GIF.")
    } finally {
      setSending(false)
    }
  }

  const filteredEmojis = emojiSearch.trim()
    ? EMOJI_CATEGORIES.flatMap(cat => cat.emojis).filter(e =>
        e.keywords.toLowerCase().includes(emojiSearch.trim().toLowerCase()) || e.char.includes(emojiSearch.trim())
      )
    : (EMOJI_CATEGORIES.find(c => c.name === emojiCategory) || EMOJI_CATEGORIES[0]).emojis

  const filteredGifs = CURATED_GIFS.filter(g => {
    if (gifSearch.trim()) {
      const term = gifSearch.trim().toLowerCase()
      return (
        g.title.toLowerCase().includes(term) ||
        g.category.toLowerCase().includes(term) ||
        g.tags.some(t => t.toLowerCase().includes(term))
      )
    }
    if (gifCategory !== "Tudo") {
      return g.category === gifCategory
    }
    return true
  })

  const colleagues = members.filter(member => member.user_id !== initial.viewerId && member.name.toLocaleLowerCase("pt").includes(search.toLocaleLowerCase("pt")))

  return <div className="relative p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
    <div className={styles.heading}>
      <div>
        <h1>Chat da equipa</h1>
        <p>Canais temáticos e conversas privadas com a equipa.</p>
      </div>
      <span><Users size={15} /> Interno · OPS</span>
    </div>

    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Conversas">
        {/* Secção de Canais */}
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>CANAIS</span>
          <button
            type="button"
            className={styles.createChannelBtn}
            onClick={() => { setChannelError(null); setShowCreateModal(true) }}
            title="Criar novo canal"
            aria-label="Criar novo canal"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className={styles.channelsList}>
          {channels.map(ch => {
            const isSelected = !recipient && activeChannel === ch.slug
            return (
              <button
                type="button"
                key={ch.slug}
                className={`${styles.conversation} ${isSelected ? styles.selected : ""}`}
                onClick={() => selectChannel(ch.slug)}
                disabled={sending}
                aria-pressed={isSelected}
              >
                <span className={styles.generalIcon}><Hash size={18} /></span>
                <span>
                  <strong>#{ch.name}</strong>
                  <small>{ch.description || "Canal de equipa"}</small>
                </span>
              </button>
            )
          })}
        </div>

        {/* Secção de Conversas Privadas */}
        <label className={styles.search}>
          <Search size={16} />
          <input aria-label="Procurar colega" placeholder="Procurar colega" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <p className={styles.sectionLabel}>CONVERSAS PRIVADAS</p>
        <div className={styles.colleagues}>
          {colleagues.map((member: ChatMember) => (
            <button
              type="button"
              key={member.user_id}
              className={`${styles.conversation} ${recipient === member.user_id ? styles.selected : ""}`}
              disabled={sending || olderLoading}
              onClick={() => selectConversation(member.user_id)}
              aria-pressed={recipient === member.user_id}
            >
              <Avatar name={member.name} url={member.avatar_url} />
              <span>
                <strong>{member.name}</strong>
                <small>Conversa privada</small>
              </span>
            </button>
          ))}
        </div>
        {!colleagues.length && <p className={styles.directoryNote}>{search ? "Nenhum colega encontrado." : "Os colegas aparecem aqui depois de abrirem o chat pela primeira vez."}</p>}
        <div className={styles.myProfile}>
          {me && <Avatar name={me.name} url={me.avatar_url} />}
          <span>
            <strong>{me?.name || "A tua conta"}</strong>
            <small>Sessão iniciada</small>
          </span>
        </div>
      </aside>

      {/* Thread de Mensagens */}
      <section className={styles.thread} aria-label={recipient ? `Conversa com ${peer?.name || "colega"}` : `#${currentChannel.name}`}>
        <div className={styles.threadHeader}>
          <div className={styles.threadTitle}>
            {recipient ? <LockKeyhole size={20} /> : <Hash size={22} />}
            <div>
              <h2>{recipient ? peer?.name || "Conversa privada" : `# ${currentChannel.name}`}</h2>
              <p>{recipient ? "Visível apenas aos dois participantes" : currentChannel.description || "Canal público para a equipa"}</p>
            </div>
          </div>
          <button type="button" className={styles.refresh} aria-label="Atualizar conversa" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} /></button>
        </div>

        {error && <div className={styles.error} role="alert">{error}{blocked && " Volte a iniciar sessão se necessário."}</div>}

        <div className={styles.messages} ref={scroll} onScroll={event => { const node = event.currentTarget; stickBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }} role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions">
          {hasOlder && <button type="button" className={styles.older} onClick={loadOlder} disabled={olderLoading}>{olderLoading ? "A carregar…" : "Ver mensagens anteriores"}</button>}
          {!ready && !error && <p className={styles.loading} role="status">A abrir conversa…</p>}
          {ready && !messages.length && <div className={styles.empty}>
            <MessageSquare size={32} strokeWidth={1.5} />
            <h3>{recipient ? "Começa a conversa" : `Bem-vindos ao #${currentChannel.name}`}</h3>
            <p>{recipient ? `Escreve uma mensagem a ${peer?.name || "este colega"}.` : (currentChannel.description || "Partilha novidades, combina tarefas e mantém a equipa a par.")}</p>
          </div>}

          {messages.map((message, index) => {
            const own = message.sender_id === initial.viewerId
            const showDate = !index || dateLabel(messages[index - 1].created_at) !== dateLabel(message.created_at)
            const gifInfo = parseGifMessage(message.body)
            const onlyEmoji = !gifInfo.isGif && isOnlyEmojis(message.body)
            return <div key={message.id}>
              {showDate && <div className={styles.day}>{dateLabel(message.created_at)}</div>}
              <article className={`${styles.message} ${own ? styles.own : ""}`}>
                {!own && <Avatar name={message.sender_name} url={message.sender_avatar_url} />}
                <div className={styles.bubble}>
                  <div className={styles.messageMeta}>
                    <strong>{own ? `${message.sender_name} (tu)` : message.sender_name}</strong>
                    <time dateTime={message.created_at} title={dateLabel(message.created_at)}>{timeLabel(message.created_at)}</time>
                  </div>
                  {gifInfo.isGif ? (
                    <div>
                      {gifInfo.text && <p style={{ marginBottom: 6 }}>{gifInfo.text}</p>}
                      <div className={styles.gifBubble}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gifInfo.gifUrl} alt="GIF animado" loading="lazy" />
                      </div>
                    </div>
                  ) : onlyEmoji ? (
                    <p className={styles.largeEmoji}>{message.body}</p>
                  ) : (
                    <p>{message.body}</p>
                  )}
                </div>
              </article>
            </div>
          })}
        </div>

        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send() }}>
          {/* Emoji Popover */}
          {showEmojiPicker && (
            <div className={styles.emojiPopover} ref={emojiPopoverRef} role="dialog" aria-label="Seletor de emojis">
              <div className={styles.emojiSearch}>
                <input
                  type="text"
                  placeholder="Procurar emoji..."
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.emojiTabs}>
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    className={`${styles.emojiTab} ${emojiCategory === cat.name && !emojiSearch ? styles.activeTab : ""}`}
                    onClick={() => {
                      setEmojiCategory(cat.name)
                      setEmojiSearch("")
                    }}
                  >
                    {cat.icon} {cat.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className={styles.emojiGrid}>
                {filteredEmojis.map((e, idx) => (
                  <button
                    key={`${e.char}-${idx}`}
                    type="button"
                    className={styles.emojiItem}
                    onClick={() => handleSelectEmoji(e.char)}
                    title={e.keywords}
                  >
                    {e.char}
                  </button>
                ))}
                {filteredEmojis.length === 0 && (
                  <p style={{ gridColumn: "span 8", textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: 12 }}>
                    Nenhum emoji encontrado
                  </p>
                )}
              </div>
            </div>
          )}

          {/* GIF Popover */}
          {showGifPicker && (
            <div className={styles.gifPopover} ref={gifPopoverRef} role="dialog" aria-label="Seletor de GIFs animados">
              <div className={styles.gifHeader}>
                <div className={styles.gifSearchBox}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Procurar GIFs (sucesso, foco, café...)"
                    value={gifSearch}
                    onChange={e => setGifSearch(e.target.value)}
                    autoFocus
                  />
                  {gifSearch && (
                    <button
                      type="button"
                      onClick={() => setGifSearch("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-secondary)" }}
                      aria-label="Limpar pesquisa"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.gifCategories}>
                  {["Tudo", "Celebração", "Equipa", "Trabalho", "Logística", "Reações"].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.gifCategoryBadge} ${gifCategory === cat && !gifSearch ? styles.activeBadge : ""}`}
                      onClick={() => {
                        setGifCategory(cat)
                        setGifSearch("")
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.gifGrid}>
                {filteredGifs.map(gif => (
                  <div
                    key={gif.id}
                    className={styles.gifCard}
                    onClick={() => void handleSendGif(gif)}
                    role="button"
                    tabIndex={0}
                    title={`Enviar GIF: ${gif.title}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        void handleSendGif(gif)
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                    <span className={styles.gifCardTitle}>{gif.title}</span>
                  </div>
                ))}
                {filteredGifs.length === 0 && (
                  <p style={{ gridColumn: "span 2", textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: 20 }}>
                    Nenhum GIF encontrado para &quot;{gifSearch}&quot;
                  </p>
                )}
              </div>
            </div>
          )}

          <div className={styles.composerTools}>
            <button
              type="button"
              className={`${styles.mediaBtn} ${showEmojiPicker ? styles.active : ""}`}
              onClick={() => {
                setShowEmojiPicker(v => !v)
                setShowGifPicker(false)
              }}
              title="Adicionar emoji"
              aria-label="Adicionar emoji"
              aria-expanded={showEmojiPicker}
            >
              <Smile size={16} />
              <span>Emoji</span>
            </button>
            <button
              type="button"
              className={`${styles.mediaBtn} ${showGifPicker ? styles.active : ""}`}
              onClick={() => {
                setShowGifPicker(v => !v)
                setShowEmojiPicker(false)
              }}
              title="Inserir GIF animado"
              aria-label="Inserir GIF animado"
              aria-expanded={showGifPicker}
            >
              <Film size={15} />
              <span>GIF</span>
              <span className={styles.gifBadge}>HD</span>
            </button>
          </div>

          <label className="sr-only" htmlFor="team-chat-message">Mensagem</label>
          <textarea
            ref={textareaRef}
            id="team-chat-message"
            placeholder={recipient ? `Mensagem para ${peer?.name || "colega"}…` : `Escreve em #${currentChannel.name}…`}
            rows={2}
            maxLength={CHAT_MAX_LENGTH}
            value={draft}
            disabled={!ready || blocked || sending}
            onChange={event => setDrafts(previous => ({ ...previous, [key]: event.target.value }))}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }}
          />
          <div className={styles.composerFooter}>
            <small>
              <span className={styles.keyboardHint}>Enter para enviar · Shift + Enter para nova linha · </span>
              {draft.length}/{CHAT_MAX_LENGTH}
            </small>
            <button type="submit" disabled={!ready || blocked || sending || !draft.trim()}>
              <Send size={16} />{sending ? "A enviar…" : "Enviar"}
            </button>
          </div>
        </form>
      </section>
    </div>

    {/* Modal para criar canal */}
    {showCreateModal && (
      <div className={styles.modalOverlay} onClick={() => !creatingChannel && setShowCreateModal(false)}>
        <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="modal-title">
          <header className={styles.modalHeader}>
            <h3 id="modal-title">Criar novo canal</h3>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setShowCreateModal(false)}
              disabled={creatingChannel}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>
          <form onSubmit={handleCreateChannel}>
            <div className={styles.modalBody}>
              {channelError && <div className={styles.modalError}>{channelError}</div>}
              <div className={styles.field}>
                <label htmlFor="new-channel-name">Nome do canal *</label>
                <input
                  id="new-channel-name"
                  type="text"
                  placeholder="ex: Operações, Armazém, Incidências"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  required
                  disabled={creatingChannel}
                />
                <small>Será prefixado com # automaticamente</small>
              </div>
              <div className={styles.field}>
                <label htmlFor="new-channel-desc">Descrição (opcional)</label>
                <textarea
                  id="new-channel-desc"
                  placeholder="ex: Coordenação de recolhas, trânsito e incidências"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  maxLength={250}
                  rows={2}
                  disabled={creatingChannel}
                />
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowCreateModal(false)}
                disabled={creatingChannel}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={creatingChannel || !newChannelName.trim()}
              >
                {creatingChannel ? "A criar…" : "Criar canal"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    )}
  </div>
}

