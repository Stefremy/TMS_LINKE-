"use client"

import * as React from "react"
import Link from "next/link"
import { 
  FileText, 
  Euro, 
  Plus, 
  Trash2, 
  Sparkles, 
  Building, 
  Calendar, 
  CreditCard, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Cloud, 
  RefreshCw,
  Search,
  Layers,
  ArrowRight
} from "lucide-react"
import { emitCustomInvoiceAction, CustomInvoiceItemInput } from "@/app/actions/moloni"

interface Client {
  id: string
  short_name?: string
  legal_name?: string
  nif?: string
  address?: string
  postal_code?: string
  city?: string
  email?: string
  phone?: string
}

interface CustomInvoiceHistoryItem {
  id: string
  invoice_number: string
  client_name: string
  client_vat?: string
  invoice_date: string
  due_date?: string
  payment_terms?: string
  total_value: number
  items_count: number
  items: any[]
  moloni_document_id?: number | null
  moloni_document_pdf?: string | null
  pdf_url: string
  created_at: string
}

const SERVICE_TEMPLATES = [
  {
    title: "Desenvolvimento de Website Institucional",
    description: "Criação de website responsivo em Next.js com páginas institucionais, catálogo e formulários.",
    unitPrice: 850,
    taxRate: 23,
    icon: "🌐"
  },
  {
    title: "Criação de Loja Online E-Commerce",
    description: "Implementação de plataforma de comércio eletrónico com gestão de produtos, pagamentos e envios Linke.",
    unitPrice: 1450,
    taxRate: 23,
    icon: "🛒"
  },
  {
    title: "Consultoria Estratégica de Logística & E-Commerce",
    description: "Sessão de consultoria e otimização de fluxos operacionais de transporte e integração de inventário.",
    unitPrice: 350,
    taxRate: 23,
    icon: "💼"
  },
  {
    title: "Manutenção Web & Alojamento Mensal",
    description: "Avença mensal de suporte técnico, atualizações de segurança e alojamento cloud.",
    unitPrice: 75,
    taxRate: 23,
    icon: "🛠️"
  },
  {
    title: "Design Gráfico & Identidade Visual",
    description: "Criação de material gráfico corporativo, logótipos e banners para redes sociais e loja online.",
    unitPrice: 250,
    taxRate: 23,
    icon: "🎨"
  },
  {
    title: "Serviço Operacional Extra / Armazenagem",
    description: "Taxa suplementar de reenvio, manuseamento de carga especial ou armazenagem temporária em armazém.",
    unitPrice: 120,
    taxRate: 23,
    icon: "📦"
  }
]

export default function FaturaPersonalizadaClient({
  clients = [],
  initialInvoices = [],
  moloniConfig
}: {
  clients: Client[]
  initialInvoices: CustomInvoiceHistoryItem[]
  moloniConfig?: { isConnected: boolean; companyName?: string }
}) {
  const [invoices, setInvoices] = React.useState<CustomInvoiceHistoryItem[]>(initialInvoices)
  
  // Seleção de Cliente
  const [selectedClientId, setSelectedClientId] = React.useState<string>("")
  const [clientSearch, setClientSearch] = React.useState<string>("")
  const [clientName, setClientName] = React.useState<string>("")
  const [clientVat, setClientVat] = React.useState<string>("")
  const [clientAddress, setClientAddress] = React.useState<string>("")
  const [clientZip, setClientZip] = React.useState<string>("")
  const [clientCity, setClientCity] = React.useState<string>("")
  const [clientEmail, setClientEmail] = React.useState<string>("")
  const [clientPhone, setClientPhone] = React.useState<string>("")

  // Dados da Fatura
  const todayStr = new Date().toISOString().split("T")[0]
  const [invoiceDate, setInvoiceDate] = React.useState<string>(todayStr)
  const [dueDate, setDueDate] = React.useState<string>(todayStr)
  const [paymentTerms, setPaymentTerms] = React.useState<string>("Pronto Pagamento")
  const [paymentMethod, setPaymentMethod] = React.useState<string>("Transferência Bancária")
  const [notes, setNotes] = React.useState<string>("IBAN Linke: PT50 0033 0000 8765 4321 0987 1 | Millennium BCP")

  // Linhas de Serviço
  const [items, setItems] = React.useState<CustomInvoiceItemInput[]>([
    {
      title: "Desenvolvimento de Website",
      description: "Criação de plataforma web profissional",
      qty: 1,
      unitPrice: 850,
      taxRate: 23,
      discountPct: 0
    }
  ])

  // Estado de envio
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successData, setSuccessData] = React.useState<{
    invoiceNumber: string
    pdfUrl: string
    totalValue: number
    moloniDocumentId?: number | null
    moloniError?: string | null
  } | null>(null)

  // Filtro do histórico
  const [historySearch, setHistorySearch] = React.useState<string>("")

  // Quando o utilizador seleciona um cliente da lista
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId)
    if (!clientId) {
      return
    }
    const found = clients.find(c => c.id === clientId)
    if (found) {
      setClientName(found.legal_name || found.short_name || "")
      setClientVat(found.nif || "")
      setClientAddress(found.address || "")
      setClientZip(found.postal_code || "")
      setClientCity(found.city || "Portugal")
      setClientEmail(found.email || "")
      setClientPhone(found.phone || "")
    }
  }

  // Atalho de prazos de vencimento
  const handlePaymentTermsChange = (term: string) => {
    setPaymentTerms(term)
    const base = new Date(invoiceDate || todayStr)
    if (term === "Pronto Pagamento") {
      setDueDate(invoiceDate)
    } else if (term === "15 dias") {
      base.setDate(base.getDate() + 15)
      setDueDate(base.toISOString().split("T")[0])
    } else if (term === "30 dias") {
      base.setDate(base.getDate() + 30)
      setDueDate(base.toISOString().split("T")[0])
    } else if (term === "60 dias") {
      base.setDate(base.getDate() + 60)
      setDueDate(base.toISOString().split("T")[0])
    }
  }

  // Adicionar linha
  const handleAddItem = (template?: typeof SERVICE_TEMPLATES[0]) => {
    if (template) {
      setItems(prev => [
        ...prev,
        {
          title: template.title,
          description: template.description,
          qty: 1,
          unitPrice: template.unitPrice,
          taxRate: template.taxRate,
          discountPct: 0
        }
      ])
    } else {
      setItems(prev => [
        ...prev,
        {
          title: "",
          description: "",
          qty: 1,
          unitPrice: 0,
          taxRate: 23,
          discountPct: 0
        }
      ])
    }
  }

  // Remover linha
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ title: "", description: "", qty: 1, unitPrice: 0, taxRate: 23, discountPct: 0 }])
      return
    }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Atualizar campo de uma linha
  const handleItemChange = (index: number, field: keyof CustomInvoiceItemInput, value: any) => {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // Cálculos financeiros em tempo real
  const calculations = React.useMemo(() => {
    let subtotal = 0
    let totalDiscount = 0
    const taxMap: Record<number, { base: number; tax: number }> = {}

    items.forEach(it => {
      const qty = Number(it.qty || 0)
      const price = Number(it.unitPrice || 0)
      const disc = Number(it.discountPct || 0)
      const gross = qty * price
      const discVal = gross * (disc / 100)
      const net = gross - discVal
      const taxRate = Number(it.taxRate !== undefined ? it.taxRate : 23)
      const taxVal = net * (taxRate / 100)

      subtotal += gross
      totalDiscount += discVal

      if (!taxMap[taxRate]) {
        taxMap[taxRate] = { base: 0, tax: 0 }
      }
      taxMap[taxRate].base += net
      taxMap[taxRate].tax += taxVal
    })

    const totalNet = subtotal - totalDiscount
    let totalTax = 0
    Object.values(taxMap).forEach(t => {
      totalTax += t.tax
    })
    const grandTotal = totalNet + totalTax

    return { subtotal, totalDiscount, totalNet, taxMap, totalTax, grandTotal }
  }, [items])

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!clientName.trim()) {
      setErrorMsg("Por favor indique o nome do cliente a faturar.")
      return
    }

    const hasValidItems = items.some(it => it.title.trim().length > 0 && Number(it.unitPrice) > 0)
    if (!hasValidItems) {
      setErrorMsg("Adicione pelo menos um serviço com nome e preço superior a 0,00€.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await emitCustomInvoiceAction({
        clientId: selectedClientId || undefined,
        clientName,
        clientVat,
        clientAddress,
        clientZip,
        clientCity,
        clientEmail,
        clientPhone,
        invoiceDate,
        dueDate,
        paymentTerms,
        paymentMethod,
        notes,
        items
      })

      if (!res.success) {
        throw new Error(res.error || "Erro ao emitir a fatura.")
      }

      // Download automático no navegador imediatamente
      const safeDlFilename = `${(res.invoiceNumber || "Fatura").replace(/[\/\\]/g, "_")}.pdf`
      try {
        const autoLink = document.createElement("a")
        autoLink.href = res.pdfUrl!
        autoLink.setAttribute("download", safeDlFilename)
        autoLink.target = "_blank"
        document.body.appendChild(autoLink)
        autoLink.click()
        document.body.removeChild(autoLink)
      } catch (dlErr) {
        console.warn("Auto-download failed:", dlErr)
      }

      setSuccessData({
        invoiceNumber: res.invoiceNumber!,
        pdfUrl: res.pdfUrl!,
        totalValue: res.totalValue!,
        moloniDocumentId: res.moloniDocumentId,
        moloniError: res.moloniError
      })

      // Atualizar lista local
      setInvoices(prev => [
        {
          id: res.id!,
          invoice_number: res.invoiceNumber!,
          client_name: clientName,
          client_vat: clientVat,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          total_value: res.totalValue!,
          items_count: items.length,
          items: [...items],
          moloni_document_id: res.moloniDocumentId,
          moloni_document_pdf: res.moloniDocumentPdf,
          pdf_url: res.pdfUrl!,
          created_at: new Date().toISOString()
        },
        ...prev
      ])
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao emitir a fatura.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtrar clientes para o dropdown de pesquisa
  const filteredClients = React.useMemo(() => {
    if (!clientSearch) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter(c => 
      (c.legal_name && c.legal_name.toLowerCase().includes(q)) ||
      (c.short_name && c.short_name.toLowerCase().includes(q)) ||
      (c.nif && c.nif.includes(q))
    )
  }, [clients, clientSearch])

  // Filtrar histórico de faturas
  const filteredHistory = React.useMemo(() => {
    if (!historySearch) return invoices
    const q = historySearch.toLowerCase()
    return invoices.filter(inv => 
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.client_name.toLowerCase().includes(q) ||
      (inv.client_vat && inv.client_vat.includes(q))
    )
  }, [invoices, historySearch])

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-8rem)] pb-12">
      {/* 1. Header com Abas de Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Euro className="w-6 h-6 text-indigo-600" />
            Faturação & Contas Corrente
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Emissão de faturas oficiais no Moloni para envios de transporte e serviços adicionais
          </p>
        </div>

        {/* Indicador de Estado do Moloni */}
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          {moloniConfig?.isConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
              <Cloud className="w-3.5 h-3.5" />
              <span>Moloni Ligado: {moloniConfig.companyName || "Empresa"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Modo Demonstrativo (Moloni Desconectado)</span>
            </div>
          )}
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-8">
        <Link
          href="/ops/faturacao/contas-corrente"
          className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-colors flex items-center gap-2"
        >
          <Building className="w-4 h-4" />
          Contas Corrente (Envios de Transporte)
        </Link>
        <div className="px-5 py-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 flex items-center gap-2 bg-indigo-50/50 rounded-t-lg">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Fatura Personalizada (Serviços & Consultoria)
        </div>
      </div>

      {/* Modal de Sucesso com Link do PDF */}
      {successData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 text-center">
              Fatura Criada com Sucesso!
            </h3>
            <p className="text-sm text-slate-500 text-center mt-1">
              O documento foi registado no sistema com a referência{" "}
              <span className="font-bold text-slate-800">{successData.invoiceNumber}</span>.
            </p>

            <div className="my-5 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Valor Total:</span>
                <span className="font-bold text-slate-900">{successData.totalValue.toFixed(2)} €</span>
              </div>
              {successData.moloniDocumentId && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ID Moloni:</span>
                  <span className="font-semibold text-emerald-600">#{successData.moloniDocumentId}</span>
                </div>
              )}
              {successData.moloniError && (
                <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  Nota Moloni: {successData.moloniError} (PDF interno gerado com sucesso)
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={successData.pdfUrl}
                download={`${(successData.invoiceNumber || "Fatura").replace(/[\/\\]/g, "_")}.pdf`}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors text-xs"
              >
                <Download className="w-4 h-4" />
                Descarregar PDF Novamente
              </a>
              <a
                href={`${successData.pdfUrl}?inline=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver no Navegador
              </a>
              <button
                onClick={() => setSuccessData(null)}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Grid Principal: Formulário de Criação à Esquerda e Resumo/Ações à Direita */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna da Esquerda (2 colunas de largura) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card de Atalhos Rápidos (Templates) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Atalhos de Serviços Rápidos</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
                Clique para adicionar
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Selecione serviços habituais da empresa para preencher automaticamente as linhas de faturação:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {SERVICE_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddItem(tmpl)}
                  className="text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">{tmpl.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 leading-tight">
                        {tmpl.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {tmpl.description}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900">{tmpl.unitPrice.toFixed(2)} €</span>
                    <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      + Adicionar
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Card de Dados do Cliente */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Entidade / Cliente a Faturar</h2>
            </div>

            {/* Dropdown de Clientes Existentes */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecionar Cliente Registado (Preenche automaticamente)
              </label>
              <select
                value={selectedClientId}
                onChange={e => handleClientSelect(e.target.value)}
                className="w-full text-sm py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Cliente Avulso / Novo Cliente --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name || c.short_name} {c.nif ? `(NIF: ${c.nif})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Campos de Dados do Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Empresa Exemplo, Lda"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIF / Número de Contribuinte
                </label>
                <input
                  type="text"
                  placeholder="Ex: 512345678"
                  value={clientVat}
                  onChange={e => setClientVat(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Morada de Faturação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rua de Santa Maria, 120"
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código Postal
                </label>
                <input
                  type="text"
                  placeholder="Ex: 4800-001"
                  value={clientZip}
                  onChange={e => setClientZip(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Localidade / Cidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Guimarães"
                  value={clientCity}
                  onChange={e => setClientCity(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email de Faturação
                </label>
                <input
                  type="email"
                  placeholder="financeiro@empresa.pt"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone / Contacto
                </label>
                <input
                  type="text"
                  placeholder="912 345 678"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Card de Linhas de Serviços e Artigos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                <h2 className="text-base font-bold text-slate-900">Linhas de Serviço / Artigos</h2>
              </div>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-1.5 px-3 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Linha
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => {
                const lineGross = Number(item.qty || 0) * Number(item.unitPrice || 0)
                const lineDiscount = lineGross * (Number(item.discountPct || 0) / 100)
                const lineNet = lineGross - lineDiscount
                const lineTax = lineNet * (Number(item.taxRate !== undefined ? item.taxRate : 23) / 100)
                const lineTotal = lineNet + lineTax

                return (
                  <div
                    key={index}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        Linha #{index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          title="Remover linha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Descrição do Serviço / Artigo *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Desenvolvimento de Loja Online Shopify"
                          value={item.title}
                          onChange={e => handleItemChange(index, "title", e.target.value)}
                          className="w-full text-sm py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Detalhes / Resumo (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Integração de métodos de pagamento"
                          value={item.description || ""}
                          onChange={e => handleItemChange(index, "description", e.target.value)}
                          className="w-full text-sm py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Qtd
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={e => handleItemChange(index, "qty", Number(e.target.value))}
                          className="w-full text-sm py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Preço Unit. (€ s/ IVA)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(index, "unitPrice", Number(e.target.value))}
                          className="w-full text-sm py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Taxa de IVA
                        </label>
                        <select
                          value={item.taxRate}
                          onChange={e => handleItemChange(index, "taxRate", Number(e.target.value))}
                          className="w-full text-sm py-1.5 px-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="23">23% (Normal)</option>
                          <option value="13">13% (Intermédia)</option>
                          <option value="6">6% (Reduzida)</option>
                          <option value="0">0% (Isento Artº 9º / Autoliquidação)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Desc. (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPct || 0}
                          onChange={e => handleItemChange(index, "discountPct", Number(e.target.value))}
                          className="w-full text-sm py-1.5 px-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2 flex flex-col justify-end text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Total c/ IVA</span>
                        <span className="text-sm font-black text-slate-900">
                          {lineTotal.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coluna da Direita (1 coluna de largura): Condições, Totais e Botão de Emissão */}
        <div className="space-y-6">
          {/* Card de Condições de Pagamento e Datas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">Datas & Condições</h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data da Fatura
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prazo de Pagamento
              </label>
              <select
                value={paymentTerms}
                onChange={e => handlePaymentTermsChange(e.target.value)}
                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Pronto Pagamento">Pronto Pagamento</option>
                <option value="15 dias">A 15 dias</option>
                <option value="30 dias">A 30 dias</option>
                <option value="60 dias">A 60 dias</option>
                <option value="Personalizado">Data Personalizada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Método de Pagamento Preferencial
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Multibanco">Referência Multibanco</option>
                <option value="MB WAY">MB WAY</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Numerário">Numerário / Pronto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observações / Informações Bancárias
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="IBAN, referências de encomenda..."
                className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Card de Resumo de Totais */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Resumo da Fatura
            </h3>

            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal Ilíquido:</span>
              <span className="font-semibold text-slate-900">{calculations.subtotal.toFixed(2)} €</span>
            </div>

            {calculations.totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-rose-600">
                <span>Descontos:</span>
                <span className="font-semibold">-{calculations.totalDiscount.toFixed(2)} €</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Líquido Tributável:</span>
              <span className="font-semibold text-slate-900">{calculations.totalNet.toFixed(2)} €</span>
            </div>

            {/* IVA discriminado */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              {Object.entries(calculations.taxMap).map(([rate, t]) => (
                <div key={rate} className="flex justify-between text-[11px] text-slate-500">
                  <span>IVA ({rate}% s/ {t.base.toFixed(2)} €):</span>
                  <span className="font-medium text-slate-700">{t.tax.toFixed(2)} €</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-slate-600 font-semibold pt-1">
                <span>Total de IVA:</span>
                <span className="text-slate-900">{calculations.totalTax.toFixed(2)} €</span>
              </div>
            </div>

            {/* Total Final em Destaque */}
            <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Total a Pagar</span>
                <div className="text-[10px] text-slate-400">c/ IVA incluído</div>
              </div>
              <span className="text-2xl font-black text-emerald-600">
                {calculations.grandTotal.toFixed(2)} €
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botão de Emissão */}
            <button
              type="submit"
              disabled={isSubmitting || calculations.grandTotal <= 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-sm mt-4 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  A Emitir Fatura...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Emitir Fatura Oficial
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Gera documento certificado no Moloni e PDF pronto para envio ao cliente
            </p>
          </div>
        </div>
      </form>

      {/* 3. Histórico de Faturas Personalizadas Emitidas */}
      <div className="mt-12 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Histórico de Faturas Personalizadas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulte e descarregue faturas de serviços extras e consultoria emitidas anteriormente
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar fatura ou cliente..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-600">Nenhuma fatura personalizada encontrada</div>
            <p className="text-xs text-slate-400 mt-1">
              As faturas de website, e-commerce ou consultoria que emitir aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Cliente / Entidade</th>
                  <th className="py-3 px-4">Serviços</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{inv.client_name}</div>
                      {inv.client_vat && (
                        <div className="text-[10px] text-slate-400">NIF: {inv.client_vat}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">
                      {inv.items && inv.items.length > 0 ? (
                        <span title={inv.items.map(i => i.title).join(", ")}>
                          {inv.items[0].title}
                          {inv.items.length > 1 && ` (+${inv.items.length - 1})`}
                        </span>
                      ) : (
                        `${inv.items_count} serviço(s)`
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {inv.due_date || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {inv.total_value.toFixed(2)} €
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={inv.pdf_url}
                          download={`${inv.invoice_number.replace(/[\/\\]/g, "_")}.pdf`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-xs transition-colors shadow-2xs"
                          title="Descarregar PDF para o computador"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descarregar
                        </a>
                        <a
                          href={`${inv.pdf_url}?inline=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-xs transition-colors"
                          title="Ver PDF no navegador"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
