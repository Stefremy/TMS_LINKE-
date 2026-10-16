"use client"

import { useMemo, useRef, useState } from "react"
import { AlertCircle, Check, Download, FileText, FolderOpen, LoaderCircle, Plus, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react"

type DocumentRecord = {
  id: string
  owner_type: "linke" | "employee"
  collaborator_id: string | null
  collaborator_name: string | null
  category: string
  title: string
  description: string | null
  original_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string
  created_at: string
}
type Collaborator = { id: string; name: string; email: string }

const LINK_E_CATEGORIES = ["Políticas e procedimentos", "Financeiro e contratos", "Operações", "Legal", "Outro"]
const EMPLOYEE_CATEGORIES = ["Contrato", "Identificação", "Formação", "Segurança e saúde", "Outro"]

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function DocumentsClient({ initialDocuments, collaborators, loadError }: {
  initialDocuments: DocumentRecord[]
  collaborators: Collaborator[]
  loadError: string | null
}) {
  const setupRequired = Boolean(loadError)
  const [documents, setDocuments] = useState(initialDocuments)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [showUploader, setShowUploader] = useState(false)
  const [ownerType, setOwnerType] = useState<"linke" | "employee">("linke")
  const [collaboratorId, setCollaboratorId] = useState("")
  const [category, setCategory] = useState(LINK_E_CATEGORIES[0])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(loadError)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => documents.filter((document) => {
    const matchesScope = scope === "all" || (scope === "linke" ? document.owner_type === "linke" : document.owner_type === "employee")
    const matchesEmployee = scope !== "employee" || !employeeFilter || document.collaborator_id === employeeFilter
    const searchText = `${document.title} ${document.category} ${document.original_name} ${document.collaborator_name || ""} ${document.description || ""}`.toLocaleLowerCase("pt-PT")
    return matchesScope && matchesEmployee && searchText.includes(query.trim().toLocaleLowerCase("pt-PT"))
  }), [documents, scope, employeeFilter, query])

  const resetForm = () => {
    setTitle(""); setDescription(""); setFile(null); setOwnerType("linke"); setCollaboratorId(""); setCategory(LINK_E_CATEGORIES[0])
    if (fileInput.current) fileInput.current.value = ""
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) { setError("Escolhe um ficheiro para carregar."); return }
    if (ownerType === "employee" && !collaboratorId) { setError("Seleciona o colaborador a que pertence o documento."); return }
    setBusy(true); setError(null); setNotice(null)
    const body = new FormData()
    body.set("file", file); body.set("owner_type", ownerType); body.set("collaborator_id", collaboratorId)
    body.set("category", category); body.set("title", title); body.set("description", description)
    try {
      const response = await fetch("/api/ops/documents", { method: "POST", body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o documento.")
      setDocuments((existing) => [result.document as DocumentRecord, ...existing])
      setNotice("Documento carregado com segurança.")
      resetForm()
      setShowUploader(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o documento.")
    } finally { setBusy(false) }
  }

  const openDocument = async (document: DocumentRecord) => {
    const newWindow = window.open("about:blank", "_blank", "noopener,noreferrer")
    setBusyId(document.id); setError(null)
    try {
      const response = await fetch(`/api/ops/documents?download=${encodeURIComponent(document.id)}`)
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || "Não foi possível abrir o documento.")
      if (newWindow) newWindow.location.href = result.url
      else window.location.assign(result.url)
    } catch (cause) {
      newWindow?.close()
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o documento.")
    } finally { setBusyId(null) }
  }

  const deleteDocument = async (document: DocumentRecord) => {
    if (!window.confirm(`Remover “${document.title}” permanentemente?`)) return
    setBusyId(document.id); setError(null); setNotice(null)
    try {
      const response = await fetch("/api/ops/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: document.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível remover o documento.")
      setDocuments((existing) => existing.filter((item) => item.id !== document.id))
      setNotice("Documento removido.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover o documento.")
    } finally { setBusyId(null) }
  }

  const categories = ownerType === "linke" ? LINK_E_CATEGORIES : EMPLOYEE_CATEGORIES

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Arquivo interno · Acesso restrito</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Documentos</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Organize documentos da Linke e ficheiros confidenciais de cada colaborador.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--accent)]" /> Só administradores e Direção Geral
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--status-critical)]/30 bg-[var(--status-critical)]/5 p-3 text-sm text-[var(--status-critical)]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}<button type="button" className="ml-auto" onClick={() => setError(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-[var(--status-success)]/30 bg-[var(--status-success)]/5 p-3 text-sm text-[var(--status-success)]"><Check className="h-4 w-4" />{notice}<button type="button" className="ml-auto" onClick={() => setNotice(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div>}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do arquivo">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><p className="text-xs font-medium text-[var(--text-secondary)]">Documentos guardados</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{documents.length}</p></div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><p className="text-xs font-medium text-[var(--text-secondary)]">Da Linke</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{documents.filter((item) => item.owner_type === "linke").length}</p></div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4"><p className="text-xs font-medium text-[var(--text-secondary)]">Por colaborador</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{documents.filter((item) => item.owner_type === "employee").length}</p></div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[{id:"all", label:"Todos"}, {id:"linke", label:"Linke"}, {id:"employee", label:"Colaboradores"}].map((item) => <button key={item.id} type="button" onClick={() => setScope(item.id)} aria-pressed={scope === item.id} className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${scope === item.id ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}>{item.label}</button>)}
            {scope === "employee" && <label><span className="sr-only">Filtrar por colaborador</span><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="h-9 max-w-[220px] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 text-xs text-[var(--text-primary)]"><option value="">Todos os colaboradores</option>{collaborators.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64"><span className="sr-only">Procurar documentos</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar documentos" className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /></label>
            <button type="button" disabled={setupRequired} title={setupRequired ? "Aplique primeiro a migração do arquivo no Supabase" : undefined} onClick={() => { setShowUploader((open) => !open); setError(null) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Carregar documento</button>
          </div>
        </div>

        {showUploader && <form onSubmit={handleUpload} className="grid gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">Guardar em
            <select value={ownerType} onChange={(event) => { const value = event.target.value as "linke" | "employee"; setOwnerType(value); setCategory((value === "linke" ? LINK_E_CATEGORIES : EMPLOYEE_CATEGORIES)[0]) }} className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)]"><option value="linke">Arquivo geral da Linke</option><option value="employee">Arquivo de colaborador</option></select>
          </label>
          {ownerType === "employee" && <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">Colaborador
            <select required value={collaboratorId} onChange={(event) => setCollaboratorId(event.target.value)} className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)]"><option value="">Selecionar colaborador</option>{collaborators.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select>
          </label>}
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">Categoria
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)]">{categories.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">Nome do documento
            <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Contrato de trabalho" className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]">Nota (opcional)
            <input maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Informação útil para encontrar o ficheiro" className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-secondary)]"><label htmlFor="staff-document-file">Ficheiro · máximo 4 MB</label>
            <div className="flex h-10 min-w-0 items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2">
              <input id="staff-document-file" ref={fileInput} required type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] || null)} className="sr-only" />
              <label htmlFor="staff-document-file" className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"><Upload className="h-3.5 w-3.5" />Escolher ficheiro</label>
              <span className="truncate text-xs font-normal text-[var(--text-secondary)]">{file?.name || "Nenhum ficheiro selecionado"}</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 md:col-span-2 xl:col-span-3"><button type="button" onClick={() => { setShowUploader(false); resetForm() }} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Cancelar</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Guardar ficheiro</button></div>
        </form>}

        <div className="divide-y divide-[var(--border-subtle)]">
          {filtered.length === 0 ? <div className="flex flex-col items-center px-4 py-14 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)]"><FolderOpen className="h-5 w-5" /></div><p className="text-sm font-semibold text-[var(--text-primary)]">{documents.length ? "Nenhum documento corresponde à pesquisa" : "O arquivo ainda está vazio"}</p><p className="mt-1 max-w-md text-xs text-[var(--text-secondary)]">Carregue contratos, certificados, políticas ou outros documentos relevantes. Os ficheiros ficam privados e só são abertos por utilizadores autorizados.</p></div> : filtered.map((document) => <article key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"><FileText className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{document.title}</h3><span className="rounded border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{document.category}</span></div><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{document.owner_type === "linke" ? "Arquivo Linke" : document.collaborator_name || "Colaborador"} · {document.original_name}</p><p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{formatDate(document.created_at)} · {formatBytes(Number(document.size_bytes))} · {document.uploaded_by}</p>{document.description && <p className="mt-1 text-xs text-[var(--text-secondary)]">{document.description}</p>}</div></div>
            <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0"><button type="button" onClick={() => openDocument(document)} disabled={busyId === document.id} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-60">{busyId === document.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Abrir</button><button type="button" onClick={() => deleteDocument(document)} disabled={busyId === document.id} aria-label={`Remover ${document.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--status-critical)]/50 hover:text-[var(--status-critical)] disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div>
          </article>)}
        </div>
        <footer className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/30 px-4 py-3 text-[11px] text-[var(--text-secondary)]"><ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />Ficheiros privados, limite 4 MB. Formatos permitidos: PDF, JPG, PNG, WebP, DOCX e XLSX.</footer>
      </section>
    </div>
  )
}
