"use client"

import * as React from "react"
import { 
  X, 
  Save, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Palette, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Truck,
  Users,
  DollarSign,
  Layers,
  Scale,
  Paperclip,
  Check,
  ChevronDown,
  UploadCloud,
  Download,
  AlertTriangle,
  RefreshCw,
  Search
} from "lucide-react"
import { saveFornecedorAction } from "@/app/actions/fornecedores"
import { 
  Fornecedor, 
  DEFAULT_PRICE_FAMILIES, 
  DEFAULT_ADDITIONAL_FEES, 
  DEFAULT_VOLUMETRICS, 
  DEFAULT_CERTIFICATES,
  ServiceFamily,
  SurchargeFee,
  VolumetricRule,
  SubcontractedVehicle,
  SubcontractedDriver,
  LedgerEntry,
  BranchAddress,
  CertificateCompliance,
  DocumentAttachment
} from "@/app/ops/entidades/fornecedores/types"

interface FornecedorModalProps {
  initialData?: Fornecedor | null
  allFornecedores?: Fornecedor[]
  onSelectFornecedor?: (forn: Fornecedor) => void
  onClose: () => void
  onSaved: (saved: Fornecedor) => void
}

const COLOR_OPTIONS = [
  { label: "Azul Ciano (Correos Express)", value: "#00a3e0" },
  { label: "Vermelho (DPD / CTT)", value: "#dc2626" },
  { label: "Azul Marinho (MRW / Linke)", value: "#1e3a8a" },
  { label: "Salmão / Coral (Correios)", value: "#f87171" },
  { label: "Azul Céu (Vasp)", value: "#38bdf8" },
  { label: "Verde Esmeralda", value: "#059669" },
  { label: "Roxo Ametista", value: "#7c3aed" },
  { label: "Âmbar / Laranja", value: "#ea580c" },
  { label: "Cinza Ardósia", value: "#475569" },
]

type TabKey = 
  | "dados_gerais"
  | "tabela_precos"
  | "taxas_adicionais"
  | "volumetrias"
  | "viaturas"
  | "motoristas"
  | "conta_corrente"
  | "filiais"
  | "certificados"
  | "documentacao"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dados_gerais", label: "Dados Gerais", icon: Building2 },
  { key: "tabela_precos", label: "Tabela Preços", icon: DollarSign },
  { key: "taxas_adicionais", label: "Taxas Adicionais", icon: Layers },
  { key: "volumetrias", label: "Volumetrias", icon: Scale },
  { key: "viaturas", label: "Viaturas Subcontratadas", icon: Truck },
  { key: "motoristas", label: "Motoristas Subcontratados", icon: Users },
  { key: "conta_corrente", label: "Conta Corrente", icon: CreditCard },
  { key: "filiais", label: "Moradas e Filiais", icon: MapPin },
  { key: "certificados", label: "Certificados e Validades", icon: ShieldCheck },
  { key: "documentacao", label: "Documentação", icon: Paperclip },
]

export function FornecedorModal({ 
  initialData, 
  allFornecedores = [], 
  onSelectFornecedor,
  onClose, 
  onSaved 
}: FornecedorModalProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabKey>("dados_gerais")
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState(false)

  // Current record state
  const [formData, setFormData] = React.useState<Partial<Fornecedor>>(() => ({
    id: initialData?.id,
    code: initialData?.code || `LK00${Math.floor(Math.random() * 90 + 10)}`,
    center_code: initialData?.center_code || "A01",
    short_name: initialData?.short_name || "",
    color: initialData?.color || "#00a3e0",
    legal_name: initialData?.legal_name || "",
    nif: initialData?.nif || "",
    role: initialData?.role || "Transportador Subcontratado",
    category: initialData?.category || "Transportador Subcontratado",
    city: initialData?.city || "MAIA",
    email: initialData?.email || "",
    traffic_email: initialData?.traffic_email || "",
    phone: initialData?.phone || "",
    mobile_phone: initialData?.mobile_phone || "",
    balance: initialData?.balance || "0,00€",
    payment_terms: initialData?.payment_terms || "A 30 dias",
    is_active: initialData?.is_active ?? true,
    country_code: initialData?.country_code || "PT",
    created_at: initialData?.created_at || new Date().toISOString(),

    // Extended Dados Gerais
    is_carrier: initialData?.is_carrier ?? true,
    is_forwarder: initialData?.is_forwarder ?? false,
    is_own_company: initialData?.is_own_company ?? false,
    alvara_number: initialData?.alvara_number || "504134-DGT",
    associated_network: initialData?.associated_network || "Rede Ibérica Expresso",
    address: initialData?.address || "Rua do Barreiro, 495",
    postal_code: initialData?.postal_code || "4470-558",
    manager_name: initialData?.manager_name || "Jorge Nunes",
    billing_agency: initialData?.billing_agency || "A01 - Sede Guimarães",
    retention_rate: initialData?.retention_rate ?? 0,
    vat_regime: initialData?.vat_regime || "Regime Geral (23%)",
    shipping_address: initialData?.shipping_address || {
      use_different: false,
      address: "",
      postal_code: "",
      city: "",
      contact: "",
    },
    iban: initialData?.iban || "PT50 0033 0000 4521 8892 1012 4",
    swift: initialData?.swift || "BCOMPTPL",
    daily_summary_enabled: initialData?.daily_summary_enabled ?? true,
    daily_summary_email: initialData?.daily_summary_email || "operacoes@correosexpress.com",
    owner_company: initialData?.owner_company || "GO LINKE UNIPESSOAL LIMITADA",
    authorized_agencies: initialData?.authorized_agencies || ["A01", "A02", "A03", "A04"],
    language_preference: initialData?.language_preference || "Português",
    observations: initialData?.observations || "",
    sync_external_invoicing: initialData?.sync_external_invoicing ?? true,

    // Tabs data
    global_markup_pct: initialData?.global_markup_pct ?? 15,
    price_families: initialData?.price_families && initialData.price_families.length > 0 
      ? initialData.price_families 
      : DEFAULT_PRICE_FAMILIES,
    additional_fees: initialData?.additional_fees && initialData.additional_fees.length > 0
      ? initialData.additional_fees
      : DEFAULT_ADDITIONAL_FEES,
    volumetrics: initialData?.volumetrics && initialData.volumetrics.length > 0
      ? initialData.volumetrics
      : DEFAULT_VOLUMETRICS,
    vehicles: initialData?.vehicles || [],
    drivers: initialData?.drivers || [],
    ledger_entries: initialData?.ledger_entries || [],
    branches: initialData?.branches || [
      {
        id: "br_1",
        code: "HUB-MAIA",
        name: "Plataforma Logística Maia (Norte)",
        address: "Rua do Barreiro, 495",
        postal_code: "4470-558",
        city: "MAIA",
        phone: "229438000",
        email: "cais.maia@correosexpress.com",
        contact_person: "Eng. Rui Moreira"
      }
    ],
    certificates: initialData?.certificates && initialData.certificates.length > 0
      ? initialData.certificates
      : DEFAULT_CERTIFICATES,
    documents: initialData?.documents || [],
  }))

  // Sync state if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        code: initialData.code || "",
        center_code: initialData.center_code || "A01",
        short_name: initialData.short_name || "",
        color: initialData.color || "#00a3e0",
        legal_name: initialData.legal_name || "",
        nif: initialData.nif || "",
        role: initialData.role || "Transportador Subcontratado",
        category: initialData.category || initialData.role || "Transportador Subcontratado",
        city: initialData.city || "",
        email: initialData.email || "",
        traffic_email: initialData.traffic_email || "",
        phone: initialData.phone || "",
        mobile_phone: initialData.mobile_phone || "",
        balance: initialData.balance || "0,00€",
        payment_terms: initialData.payment_terms || "A 30 dias",
        is_active: initialData.is_active ?? true,
        country_code: initialData.country_code || "PT",
        created_at: initialData.created_at || new Date().toISOString(),

        is_carrier: initialData.is_carrier ?? true,
        is_forwarder: initialData.is_forwarder ?? false,
        is_own_company: initialData.is_own_company ?? false,
        alvara_number: initialData.alvara_number || "",
        associated_network: initialData.associated_network || "",
        address: initialData.address || "",
        postal_code: initialData.postal_code || "",
        manager_name: initialData.manager_name || "",
        billing_agency: initialData.billing_agency || "A01 - Sede Guimarães",
        retention_rate: initialData.retention_rate ?? 0,
        vat_regime: initialData.vat_regime || "Regime Geral (23%)",
        shipping_address: initialData.shipping_address || {
          use_different: false,
          address: "",
          postal_code: "",
          city: "",
          contact: "",
        },
        iban: initialData.iban || "",
        swift: initialData.swift || "",
        daily_summary_enabled: initialData.daily_summary_enabled ?? true,
        daily_summary_email: initialData.daily_summary_email || "",
        owner_company: initialData.owner_company || "GO LINKE UNIPESSOAL LIMITADA",
        authorized_agencies: initialData.authorized_agencies || ["A01", "A02", "A03", "A04"],
        language_preference: initialData.language_preference || "Português",
        observations: initialData.observations || "",
        sync_external_invoicing: initialData.sync_external_invoicing ?? true,

        global_markup_pct: initialData.global_markup_pct ?? 15,
        price_families: initialData.price_families && initialData.price_families.length > 0 
          ? initialData.price_families 
          : DEFAULT_PRICE_FAMILIES,
        additional_fees: initialData.additional_fees && initialData.additional_fees.length > 0
          ? initialData.additional_fees
          : DEFAULT_ADDITIONAL_FEES,
        volumetrics: initialData.volumetrics && initialData.volumetrics.length > 0
          ? initialData.volumetrics
          : DEFAULT_VOLUMETRICS,
        vehicles: initialData.vehicles || [],
        drivers: initialData.drivers || [],
        ledger_entries: initialData.ledger_entries || [],
        branches: initialData.branches || [],
        certificates: initialData.certificates && initialData.certificates.length > 0
          ? initialData.certificates
          : DEFAULT_CERTIFICATES,
        documents: initialData.documents || [],
      })
    }
  }, [initialData])

  // Prev / Next supplier navigation
  const currentIndex = React.useMemo(() => {
    if (!initialData || allFornecedores.length === 0) return -1
    return allFornecedores.findIndex((f) => f.id === initialData.id)
  }, [initialData, allFornecedores])

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allFornecedores.length - 1

  const handlePrev = () => {
    if (hasPrev && onSelectFornecedor) {
      onSelectFornecedor(allFornecedores[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (hasNext && onSelectFornecedor) {
      onSelectFornecedor(allFornecedores[currentIndex + 1])
    }
  }

  // Accordion state in Tab 2 (Price Tables)
  const [expandedFamilies, setExpandedFamilies] = React.useState<Record<string, boolean>>({
    fam_nacionais: true,
    fam_ibericos: true,
  })

  const toggleFamily = (id: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Price Table Filters
  const [selectedAgencyFilter, setSelectedAgencyFilter] = React.useState("Todas")
  const [selectedClientFilter, setSelectedClientFilter] = React.useState("Geral / Tabela Base")

  // Handle Save
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!formData.short_name?.trim()) {
      alert("Por favor preencha a Designação Curta do fornecedor.")
      setActiveTab("dados_gerais")
      return
    }

    setIsSaving(true)
    try {
      const res = await saveFornecedorAction(formData)
      if (res.success) {
        setSaveSuccessMsg(true)
        onSaved(res.data)
        setTimeout(() => {
          setSaveSuccessMsg(false)
        }, 2000)
      }
    } catch (err: any) {
      alert("Erro ao gravar fornecedor: " + (err.message || "Tente novamente."))
    } finally {
      setIsSaving(false)
    }
  }

  // Format date helper
  const formattedRegistrationDate = React.useMemo(() => {
    try {
      const d = new Date(formData.created_at || Date.now())
      return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    } catch {
      return "01/09/2026"
    }
  }, [formData.created_at])

  // Pre-fill price table helper
  const handlePreFillPriceTable = () => {
    const markup = Number(formData.global_markup_pct) || 15
    const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((fam) => ({
      ...fam,
      tiers: fam.tiers.map((t) => ({
        ...t,
        margin_pct: markup,
        sell_price: Number((t.cost_price * (1 + markup / 100)).toFixed(2)),
      })),
    }))
    setFormData({ ...formData, price_families: updated })
  }

  // Toggle agency authorization
  const toggleAgencyAuth = (agencyCode: string) => {
    const current = formData.authorized_agencies || []
    if (current.includes(agencyCode)) {
      setFormData({ ...formData, authorized_agencies: current.filter((c) => c !== agencyCode) })
    } else {
      setFormData({ ...formData, authorized_agencies: [...current, agencyCode] })
    }
  }

  // Add new branch
  const handleAddBranch = () => {
    const newBranch: BranchAddress = {
      id: `br_${Date.now()}`,
      code: `HUB-${Math.floor(10 + Math.random() * 90)}`,
      name: "Nova Filial / Delegação",
      address: "Zona Industrial",
      postal_code: "4000-000",
      city: "Porto",
      phone: "220000000",
      email: "deposito@linke.pt",
      contact_person: "Encarregado de Operações"
    }
    setFormData({
      ...formData,
      branches: [...(formData.branches || []), newBranch]
    })
  }

  // Add new vehicle
  const handleAddVehicle = () => {
    const newVehicle: SubcontractedVehicle = {
      id: `veh_${Date.now()}`,
      plate: "00-AA-00",
      designation: "Carrinha Mercadorias 3.5T",
      category: "Ligeiro de Mercadorias",
      group: "Norte Expresso",
      driver: "Motorista Atribuído",
      insurance_policy: "Apólice Ativa",
      insurance_expiry: "2026-12-31",
      iuc_status: "Regularizado",
      ipo_expiry: "2026-12-31",
      status: "Ativo"
    }
    setFormData({
      ...formData,
      vehicles: [...(formData.vehicles || []), newVehicle]
    })
  }

  // Add new driver
  const handleAddDriver = () => {
    const newDriver: SubcontractedDriver = {
      id: `drv_${Date.now()}`,
      code: `MOT0${(formData.drivers?.length || 0) + 1}`,
      name: "Novo Motorista",
      nif_cc: "00000000 0 ZZ0",
      phone: "910000000",
      email: "motorista@transportador.pt",
      group: "Rota Diária",
      qualifications: "CAM Válido",
      status: "Ativo"
    }
    setFormData({
      ...formData,
      drivers: [...(formData.drivers || []), newDriver]
    })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1240px] h-[94vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* ===================== OVERVIEW HEADER ===================== */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Identity info & code */}
          <div className="flex items-center gap-3.5">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0"
              style={{ backgroundColor: formData.color || "#00a3e0" }}
            >
              {formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {formData.short_name || (initialData ? "Editar Fornecedor" : "Novo Fornecedor")}
                </h1>
                
                {/* Code badge */}
                <span className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-mono font-bold px-2 py-0.5 rounded">
                  {formData.code || "LK000"}
                </span>

                {/* Role badge */}
                <span className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {formData.category || formData.role || "Transportador Subcontratado"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="text-slate-700 font-medium">
                  {formData.legal_name || "Designação Social da Empresa"}
                </span>
                <span>•</span>
                <span>Data Registo: <strong>{formattedRegistrationDate}</strong></span>
              </div>
            </div>
          </div>

          {/* Center / Right: KPIs & Prev/Next navigation */}
          <div className="flex items-center gap-3">
            
            {/* KPI 1: Doc. Vencidos */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Doc. Vencidos</span>
              <span className="text-xs font-bold text-slate-700">0 (0,00€)</span>
            </div>

            {/* KPI 2: A Receber / Saldo */}
            <div className="hidden sm:flex flex-col items-end px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">A Receber / Saldo</span>
              <span className="text-xs font-bold text-emerald-800">{formData.balance || "0,00€"}</span>
            </div>

            {/* KPI 3: Status Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${formData.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="text-xs font-semibold text-slate-700">
                {formData.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>

            {/* Prev / Next supplier buttons */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                title="Fornecedor Anterior"
                className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed border-r border-slate-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                title="Próximo Fornecedor"
                className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Close modal */}
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

          </div>
        </div>

        {/* ===================== TAB NAVIGATION BAR ===================== */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center overflow-x-auto gap-1 text-[13px] font-medium no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "border-emerald-600 text-emerald-700 font-bold bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ===================== TAB CONTENTS ===================== */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          
          {/* TAB 1: DADOS GERAIS */}
          {activeTab === "dados_gerais" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main Column (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1.1 Identity */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      Identidade & Enquadramento
                    </h3>
                    <div className="text-xs text-slate-400 font-mono">ID: {formData.id || "Novo"}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                      <input
                        type="text"
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="LK003"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Designação Curta *</label>
                      <input
                        type="text"
                        value={formData.short_name || ""}
                        onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="CORREOS.EXPRESS"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">Categoria</label>
                        <span className="text-[11px] text-emerald-600 hover:underline cursor-pointer">Gerir categorias</span>
                      </div>
                      <select
                        value={formData.category || "Transportador Subcontratado"}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value, role: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="Transportador Subcontratado">Transportador Subcontratado</option>
                        <option value="Transportador Próprio">Transportador Próprio</option>
                        <option value="Agente Transitário">Agente Transitário</option>
                        <option value="Operador Logístico">Operador Logístico</option>
                        <option value="Distribuição Postal">Distribuição Postal</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes: É Transportador / Agente / Própria empresa */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_carrier ?? true}
                        onChange={(e) => setFormData({ ...formData, is_carrier: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-medium text-slate-700">É Transportador</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_forwarder ?? false}
                        onChange={(e) => setFormData({ ...formData, is_forwarder: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-medium text-slate-700">É Agente Transitário</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.is_own_company ?? false}
                        onChange={(e) => setFormData({ ...formData, is_own_company: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-medium text-slate-700">É a minha empresa</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nº Alvará / Licença Transporte</label>
                      <input
                        type="text"
                        value={formData.alvara_number || ""}
                        onChange={(e) => setFormData({ ...formData, alvara_number: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Ex: 504134-DGT"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Rede associada</label>
                      <input
                        type="text"
                        value={formData.associated_network || ""}
                        onChange={(e) => setFormData({ ...formData, associated_network: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Ex: Rede Ibérica Expresso"
                      />
                    </div>
                  </div>

                  {/* Identificador: color-swatch tag picker */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Identificador Visual (Marcador em Guias e Mapas)
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex items-center">
                        <input
                          type="color"
                          value={formData.color || "#00a3e0"}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                        />
                      </div>

                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.value })}
                          className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                            formData.color?.toLowerCase() === c.value.toLowerCase()
                              ? "scale-110 border-slate-900 shadow-xs"
                              : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        >
                          {formData.color?.toLowerCase() === c.value.toLowerCase() && (
                            <Check className="w-4 h-4 text-white drop-shadow-xs" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 1.2 Dados de Faturação */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Dados de Faturação
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Informação Fiscal</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">País</label>
                      <select
                        value={formData.country_code || "PT"}
                        onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="PT">Portugal (PT)</option>
                        <option value="ES">Espanha (ES)</option>
                        <option value="FR">França (FR)</option>
                        <option value="EU">Outro UE</option>
                      </select>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        NIF (Número de Identificação Fiscal)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.nif || ""}
                          onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="504134507"
                        />
                        <button
                          type="button"
                          onClick={() => alert(`NIF ${formData.nif || 'não preenchido'} validado no cadastro VIES/AT!`)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                        >
                          Validar VIES
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designação Social (Razão Social Completa)</label>
                    <input
                      type="text"
                      value={formData.legal_name || ""}
                      onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="CEP II - CORREOS EXPRESS PORTUGAL, S.A."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Morada de Faturação</label>
                    <input
                      type="text"
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Rua do Barreiro, 495"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Código Postal</label>
                      <input
                        type="text"
                        value={formData.postal_code || ""}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="4470-558"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Localidade</label>
                      <input
                        type="text"
                        value={formData.city || ""}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="MAIA"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável de Conta</label>
                      <input
                        type="text"
                        value={formData.manager_name || ""}
                        onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Jorge Nunes"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Agência Faturação</label>
                      <select
                        value={formData.billing_agency || "A01 - Sede Guimarães"}
                        onChange={(e) => setFormData({ ...formData, billing_agency: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="A01 - Sede Guimarães">A01 - Sede Guimarães</option>
                        <option value="A02 - Hub Porto">A02 - Hub Porto</option>
                        <option value="A03 - Hub Lisboa">A03 - Hub Lisboa</option>
                        <option value="A04 - Hub Algarve">A04 - Hub Algarve</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Retenção na fonte (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.retention_rate ?? 0}
                        onChange={(e) => setFormData({ ...formData, retention_rate: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Regime de IVA</label>
                      <select
                        value={formData.vat_regime || "Regime Geral (23%)"}
                        onChange={(e) => setFormData({ ...formData, vat_regime: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="Regime Geral (23%)">Regime Geral (23%)</option>
                        <option value="Isento Art. 9º">Isento Art. 9º CIVA</option>
                        <option value="Autoliquidação RUC">Autoliquidação RUC</option>
                        <option value="Regime Intracomunitário">Regime Intracomunitário</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 1.3 Dados de Contacto */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      Dados de Contacto
                    </h3>
                    <span className="text-xs text-slate-400">Comunicação Operacional</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Faturação</label>
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Jorge.nunes@correosexpress.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Tráfego / Gestão Cargas</label>
                      <input
                        type="email"
                        value={formData.traffic_email || ""}
                        onChange={(e) => setFormData({ ...formData, traffic_email: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="trafego.norte@correosexpress.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Fixo</label>
                      <input
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="229438000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Telemóvel</label>
                      <input
                        type="tel"
                        value={formData.mobile_phone || ""}
                        onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="915882310"
                      />
                    </div>
                  </div>
                </div>

                {/* 1.4 Dados de Expedição */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      Dados de Expedição (Ponto de Carga / Hub)
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.shipping_address?.use_different ?? false}
                        onChange={(e) => setFormData({
                          ...formData,
                          shipping_address: {
                            ...(formData.shipping_address || { address: "", postal_code: "", city: "", contact: "" }),
                            use_different: e.target.checked
                          }
                        })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-slate-600">Morada de expedição diferente da faturação</span>
                    </label>
                  </div>

                  {formData.shipping_address?.use_different ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Morada Cais / Depósito</label>
                        <input
                          type="text"
                          value={formData.shipping_address?.address || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            shipping_address: { ...(formData.shipping_address || { use_different: true, postal_code: "", city: "", contact: "" }), use_different: true, address: e.target.value }
                          })}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Cais Logístico Sul, Terminal 3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Contacto Cargas</label>
                        <input
                          type="text"
                          value={formData.shipping_address?.contact || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            shipping_address: { ...(formData.shipping_address || { use_different: true, address: "", postal_code: "", city: "" }), use_different: true, contact: e.target.value }
                          })}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Chefe de Cais"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded border border-slate-100">
                      A morada de expedição e recolha assume por defeito a mesma da faturação ({formData.address || "Rua do Barreiro, 495"}).
                    </div>
                  )}
                </div>

                {/* 1.5 Condições de Pagamento & Resumo Diário */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Condições Pagamento */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Condições de Pagamento
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo / Vencimento</label>
                      <select
                        value={formData.payment_terms || "A 30 dias"}
                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="A Pronto">A Pronto</option>
                        <option value="A 15 dias">A 15 dias</option>
                        <option value="A 30 dias">A 30 dias</option>
                        <option value="A 60 dias">A 60 dias</option>
                        <option value="A 90 dias">A 90 dias</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">IBAN</label>
                      <input
                        type="text"
                        value={formData.iban || ""}
                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="PT50 0033 0000 4521 8892 1012 4"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SWIFT / BIC</label>
                      <input
                        type="text"
                        value={formData.swift || ""}
                        onChange={(e) => setFormData({ ...formData, swift: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="BCOMPTPL"
                      />
                    </div>
                  </div>

                  {/* Enviar Resumo Diário */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Mail className="w-4 h-4 text-emerald-600" />
                        Enviar Resumo Diário
                      </h3>

                      <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Ativar Notificação Diária</div>
                          <div className="text-[11px] text-slate-500">Envio automático do resumo de envios/estados</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, daily_summary_enabled: !formData.daily_summary_enabled })}
                          className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${
                            formData.daily_summary_enabled ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
                          }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email Destinatário do Resumo</label>
                        <input
                          type="email"
                          value={formData.daily_summary_email || ""}
                          onChange={(e) => setFormData({ ...formData, daily_summary_email: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="operacoes@correosexpress.com"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded">
                      Os relatórios diários de tráfego são despachados todos os dias às 19:30 com as guias processadas.
                    </div>
                  </div>

                </div>

              </div>

              {/* Right Sidebar (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Status & Owner Company */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                    Controlo & Empresa Titular
                  </h3>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Fornecedor Ativo</span>
                      <span className="text-[11px] text-slate-500">Disponível para atribuição</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${
                        formData.is_active ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Empresa Proprietária</label>
                    <select
                      value={formData.owner_company || "GO LINKE UNIPESSOAL LIMITADA"}
                      onChange={(e) => setFormData({ ...formData, owner_company: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="GO LINKE UNIPESSOAL LIMITADA">GO LINKE UNIPESSOAL LIMITADA</option>
                      <option value="LINKE LOGISTICS PORTUGAL">LINKE LOGISTICS PORTUGAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Agências Autorizadas</label>
                    <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      {[
                        { code: "A01", label: "A01 - Sede Guimarães" },
                        { code: "A02", label: "A02 - Hub Maia / Porto" },
                        { code: "A03", label: "A03 - Hub Lisboa" },
                        { code: "A04", label: "A04 - Hub Faro / Algarve" },
                      ].map((ag) => {
                        const isChecked = (formData.authorized_agencies || []).includes(ag.code)
                        return (
                          <label key={ag.code} className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleAgencyAuth(ag.code)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{ag.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preferência de Idioma</label>
                    <select
                      value={formData.language_preference || "Português"}
                      onChange={(e) => setFormData({ ...formData, language_preference: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Português">Português (PT)</option>
                      <option value="Espanhol">Espanhol (ES)</option>
                      <option value="Inglês">Inglês (EN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Internas</label>
                    <textarea
                      rows={4}
                      value={formData.observations || ""}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Notas e condições contratuais específicas..."
                    />
                  </div>

                  {/* Sync to external invoicing checkbox */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sync_external_invoicing ?? true}
                        onChange={(e) => setFormData({ ...formData, sync_external_invoicing: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                      />
                      <span className="text-xs text-slate-600 font-medium leading-relaxed">
                        Sincronizar entidade com software de faturação externo (Invoicing API / ERP)
                      </span>
                    </label>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: TABELA DE PREÇOS */}
          {activeTab === "tabela_precos" && (
            <div className="space-y-6">
              
              {/* Pricing Toolbar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex flex-wrap items-center gap-4">
                  {/* Markup Global */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Markup Global:</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="0.5"
                        value={formData.global_markup_pct ?? 15}
                        onChange={(e) => setFormData({ ...formData, global_markup_pct: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 pr-6 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                    </div>
                  </div>

                  {/* Filter Agência */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Agência:</span>
                    <select
                      value={selectedAgencyFilter}
                      onChange={(e) => setSelectedAgencyFilter(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white"
                    >
                      <option value="Todas">Todas as Agências</option>
                      <option value="Guimarães">A01 - Guimarães</option>
                      <option value="Porto">A02 - Porto</option>
                      <option value="Lisboa">A03 - Lisboa</option>
                    </select>
                  </div>

                  {/* Filter Cliente */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Cliente:</span>
                    <select
                      value={selectedClientFilter}
                      onChange={(e) => setSelectedClientFilter(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white"
                    >
                      <option value="Geral / Tabela Base">Geral / Tabela Base Fornecedor</option>
                      <option value="Cliente VIP">Tabela Exclusiva Cliente A</option>
                    </select>
                  </div>
                </div>

                {/* Actions: Pré-preencher & Gravar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreFillPriceTable}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    Pré-preencher com Markup
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Gravar Tabela
                  </button>
                </div>

              </div>

              {/* Accordion groups per service family */}
              <div className="space-y-4">
                {(formData.price_families || DEFAULT_PRICE_FAMILIES).map((fam) => {
                  const isExpanded = expandedFamilies[fam.id] ?? true

                  return (
                    <div key={fam.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                      
                      {/* Family Header Accordion Toggle */}
                      <div 
                        onClick={() => toggleFamily(fam.id)}
                        className="px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                          <div>
                            <span className="text-sm font-bold text-slate-800">{fam.name}</span>
                            <span className="text-xs text-slate-500 ml-3">({fam.description})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-slate-400 font-mono">{fam.tiers.length} escalões</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newTier = {
                                id: `tier_${Date.now()}`,
                                enabled: true,
                                weight_max: 35,
                                label: "Novo Escalão",
                                zone: "PT Continental",
                                cost_price: 10.00,
                                margin_pct: Number(formData.global_markup_pct) || 15,
                                sell_price: 11.50,
                                delivery_time: "24h",
                              }
                              const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) => 
                                f.id === fam.id ? { ...f, tiers: [...f.tiers, newTier] } : f
                              )
                              setFormData({ ...formData, price_families: updated })
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold text-slate-700 flex items-center gap-1 shadow-3xs"
                          >
                            <Plus className="w-3 h-3 text-emerald-600" />
                            Adicionar Linha
                          </button>
                        </div>
                      </div>

                      {/* Expanded Price Grid Table */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-4 w-12 text-center">Ativo</th>
                                <th className="py-2.5 px-4 min-w-[140px]">Escalão Peso</th>
                                <th className="py-2.5 px-4 min-w-[140px]">Zona Destino</th>
                                <th className="py-2.5 px-4 min-w-[110px]">Custo Forn. (€)</th>
                                <th className="py-2.5 px-4 min-w-[100px]">Margem (%)</th>
                                <th className="py-2.5 px-4 min-w-[110px]">Venda Linke (€)</th>
                                <th className="py-2.5 px-4 min-w-[90px]">Trânsito</th>
                                <th className="py-2.5 px-4 w-16 text-center">Remover</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {fam.tiers.map((tier, idx) => (
                                <tr key={tier.id} className="hover:bg-slate-50/70 transition-colors">
                                  {/* Checkbox */}
                                  <td className="py-2.5 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={tier.enabled}
                                      onChange={(e) => {
                                        const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) =>
                                          f.id === fam.id
                                            ? {
                                                ...f,
                                                tiers: f.tiers.map((t) => (t.id === tier.id ? { ...t, enabled: e.target.checked } : t)),
                                              }
                                            : f
                                        )
                                        setFormData({ ...formData, price_families: updated })
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                  </td>

                                  {/* Label / Weight */}
                                  <td className="py-2.5 px-4 font-bold text-slate-800">
                                    <input
                                      type="text"
                                      value={tier.label || ""}
                                      onChange={(e) => {
                                        const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) =>
                                          f.id === fam.id
                                            ? {
                                                ...f,
                                                tiers: f.tiers.map((t) => (t.id === tier.id ? { ...t, label: e.target.value } : t)),
                                              }
                                            : f
                                        )
                                        setFormData({ ...formData, price_families: updated })
                                      }}
                                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none text-xs font-bold text-slate-800 py-0.5"
                                    />
                                  </td>

                                  {/* Zone */}
                                  <td className="py-2.5 px-4 text-slate-600 font-medium">
                                    {tier.zone}
                                  </td>

                                  {/* Cost Price */}
                                  <td className="py-2.5 px-4">
                                    <div className="relative w-24">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={tier.cost_price ?? 0}
                                        onChange={(e) => {
                                          const cost = Number(e.target.value)
                                          const sell = Number((cost * (1 + (tier.margin_pct ?? 0) / 100)).toFixed(2))
                                          const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) =>
                                            f.id === fam.id
                                              ? {
                                                  ...f,
                                                  tiers: f.tiers.map((t) => (t.id === tier.id ? { ...t, cost_price: cost, sell_price: sell } : t)),
                                                }
                                              : f
                                          )
                                          setFormData({ ...formData, price_families: updated })
                                        }}
                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                      />
                                    </div>
                                  </td>

                                  {/* Margin */}
                                  <td className="py-2.5 px-4">
                                    <div className="relative w-20">
                                      <input
                                        type="number"
                                        step="1"
                                        value={tier.margin_pct ?? 0}
                                        onChange={(e) => {
                                          const margin = Number(e.target.value)
                                          const sell = Number((tier.cost_price * (1 + margin / 100)).toFixed(2))
                                          const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) =>
                                            f.id === fam.id
                                              ? {
                                                  ...f,
                                                  tiers: f.tiers.map((t) => (t.id === tier.id ? { ...t, margin_pct: margin, sell_price: sell } : t)),
                                                }
                                              : f
                                          )
                                          setFormData({ ...formData, price_families: updated })
                                        }}
                                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                      />
                                    </div>
                                  </td>

                                  {/* Sell Price */}
                                  <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">
                                    {tier.sell_price.toFixed(2)} €
                                  </td>

                                  {/* Delivery Time */}
                                  <td className="py-2.5 px-4 text-slate-500 font-medium">
                                    {tier.delivery_time}
                                  </td>

                                  {/* Delete row */}
                                  <td className="py-2.5 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (formData.price_families || DEFAULT_PRICE_FAMILIES).map((f) =>
                                          f.id === fam.id
                                            ? { ...f, tiers: f.tiers.filter((t) => t.id !== tier.id) }
                                            : f
                                        )
                                        setFormData({ ...formData, price_families: updated })
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>

            </div>
          )}

          {/* TAB 3: TAXAS ADICIONAIS */}
          {activeTab === "taxas_adicionais" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Tabela de Taxas & Sobretaxas Fornecedor</h3>
                  <p className="text-xs text-slate-500">Taxas cobradas pelo transportador e repassadas aos clientes</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newFee: SurchargeFee = {
                      id: `fee_${Date.now()}`,
                      code: "TAXA",
                      name: "Nova Taxa Personalizada",
                      fee_type: "fixed",
                      service_scope: "Todos os Serviços",
                      zone: "Geral",
                      min_cost: 5.0,
                      max_cost: 5.0,
                      vat_rate: 23,
                      supplier_cost: 5.0,
                    }
                    setFormData({
                      ...formData,
                      additional_fees: [...(formData.additional_fees || DEFAULT_ADDITIONAL_FEES), newFee],
                    })
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Taxa Adicional
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-24">Código</th>
                      <th className="py-3 px-4 min-w-[220px]">Taxa / Descrição</th>
                      <th className="py-3 px-4 w-28">Tipo Taxa</th>
                      <th className="py-3 px-4 min-w-[160px]">Âmbito Serviço</th>
                      <th className="py-3 px-4 w-24">Zona</th>
                      <th className="py-3 px-4 w-24">Custo Min.</th>
                      <th className="py-3 px-4 w-24">Custo Max.</th>
                      <th className="py-3 px-4 w-20">IVA (%)</th>
                      <th className="py-3 px-4 w-28 font-bold text-emerald-800">Custo Forn.</th>
                      <th className="py-3 px-4 w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.additional_fees || DEFAULT_ADDITIONAL_FEES).map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{fee.code}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{fee.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            fee.fee_type === "percentage" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {fee.fee_type === "percentage" ? "Percentual (%)" : "Valor Fixo (€)"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{fee.service_scope}</td>
                        <td className="py-3 px-4 text-slate-600">{fee.zone}</td>
                        <td className="py-3 px-4 font-mono">{fee.min_cost > 0 ? `${fee.min_cost.toFixed(2)}€` : "—"}</td>
                        <td className="py-3 px-4 font-mono">{fee.max_cost > 0 ? `${fee.max_cost.toFixed(2)}€` : "—"}</td>
                        <td className="py-3 px-4 font-mono">{fee.vat_rate}%</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                          {fee.fee_type === "percentage" ? `${fee.supplier_cost}%` : `${fee.supplier_cost.toFixed(2)}€`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.additional_fees || DEFAULT_ADDITIONAL_FEES).filter((f) => f.id !== fee.id)
                              setFormData({ ...formData, additional_fees: updated })
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: VOLUMETRIAS */}
          {activeTab === "volumetrias" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <Scale className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Regras de Volumetria & Fator de Cubagem:</strong> O peso taxável da mercadoria é calculado pela fórmula 
                  <code className="bg-white/70 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-950 mx-1">
                    Max(Peso Real, Volume m³ × Coeficiente)
                  </code>.
                  Pode definir coeficientes distintos de custo (fornecedor) e venda (cliente) por zona geográfica.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-20">Zona</th>
                      <th className="py-3 px-4 min-w-[200px]">Designação / Âmbito</th>
                      <th className="py-3 px-4 min-w-[180px]">Serviço de Transporte</th>
                      <th className="py-3 px-4 w-32">Vol. Mínimo (m³)</th>
                      <th className="py-3 px-4 w-36">Coef. Custo (kg/m³)</th>
                      <th className="py-3 px-4 w-36">Coef. Venda (kg/m³)</th>
                      <th className="py-3 px-4 w-28 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.volumetrics || DEFAULT_VOLUMETRICS).map((vol) => (
                      <tr key={vol.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[11px]">
                            {vol.zone_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{vol.zone_name}</td>
                        <td className="py-3 px-4 text-slate-600">{vol.service_scope}</td>
                        <td className="py-3 px-4 font-mono">
                          <input
                            type="number"
                            step="0.001"
                            value={vol.min_volume ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              const updated = (formData.volumetrics || DEFAULT_VOLUMETRICS).map((v) =>
                                v.id === vol.id ? { ...v, min_volume: val } : v
                              )
                              setFormData({ ...formData, volumetrics: updated })
                            }}
                            className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={vol.cost_coefficient ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                const updated = (formData.volumetrics || DEFAULT_VOLUMETRICS).map((v) =>
                                  v.id === vol.id ? { ...v, cost_coefficient: val } : v
                                )
                                setFormData({ ...formData, volumetrics: updated })
                              }}
                              className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800"
                            />
                            <span className="text-[10px] text-slate-400">kg/m³</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={vol.sell_coefficient ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                const updated = (formData.volumetrics || DEFAULT_VOLUMETRICS).map((v) =>
                                  v.id === vol.id ? { ...v, sell_coefficient: val } : v
                                )
                                setFormData({ ...formData, volumetrics: updated })
                              }}
                              className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-700"
                            />
                            <span className="text-[10px] text-slate-400">kg/m³</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => alert(`Coeficiente volumétrico para ${vol.zone_name} gravado!`)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-xs font-semibold transition-colors"
                          >
                            Gravar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: VIATURAS SUBCONTRATADAS */}
          {activeTab === "viaturas" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Frota & Viaturas Subcontratadas</h3>
                  <p className="text-xs text-slate-500">Registo de veículos associados a este fornecedor de transporte</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVehicle}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Viatura
                </button>
              </div>

              {(formData.vehicles && formData.vehicles.length > 0) ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Matrícula</th>
                        <th className="py-3 px-4">Designação</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Grupo / Rota</th>
                        <th className="py-3 px-4">Motorista Habitual</th>
                        <th className="py-3 px-4">Seguro</th>
                        <th className="py-3 px-4">IPO</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.vehicles.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{v.plate}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{v.designation}</td>
                          <td className="py-3 px-4 text-slate-600">{v.category}</td>
                          <td className="py-3 px-4 text-slate-600">{v.group}</td>
                          <td className="py-3 px-4 text-slate-600">{v.driver}</td>
                          <td className="py-3 px-4 text-slate-500">{v.insurance_policy}</td>
                          <td className="py-3 px-4 text-slate-500">{v.ipo_expiry}</td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold">
                              {v.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, vehicles: formData.vehicles?.filter((x) => x.id !== v.id) })}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Nenhuma viatura registada</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Pode associar viaturas e matrículas específicas afetas a este fornecedor para controlo de capacidade e rotas diárias.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddVehicle}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registar Primeira Viatura
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: MOTORISTAS SUBCONTRATADOS */}
          {activeTab === "motoristas" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Motoristas Afetos ao Fornecedor</h3>
                  <p className="text-xs text-slate-500">Contactos e qualificações de condutores subcontratados</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDriver}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Motorista
                </button>
              </div>

              {(formData.drivers && formData.drivers.length > 0) ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Nome Completo</th>
                        <th className="py-3 px-4">NIF / Documento</th>
                        <th className="py-3 px-4">Telefone</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Grupo / Rota</th>
                        <th className="py-3 px-4">Qualificações (CAM/ADR)</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.drivers.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{d.code}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{d.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{d.nif_cc}</td>
                          <td className="py-3 px-4 text-slate-700">{d.phone}</td>
                          <td className="py-3 px-4 text-slate-600">{d.email}</td>
                          <td className="py-3 px-4 text-slate-600">{d.group}</td>
                          <td className="py-3 px-4 text-slate-500">{d.qualifications}</td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold">
                              {d.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, drivers: formData.drivers?.filter((x) => x.id !== d.id) })}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Nenhum motorista registado</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Registe motoristas para atribuir rotas, guias de transporte e recolhas pontuais no terreno.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddDriver}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registar Primeiro Motorista
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: CONTA CORRENTE */}
          {activeTab === "conta_corrente" && (
            <div className="space-y-6">
              {/* Financial KPI bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Saldo Atual</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">{formData.balance || "0,00€"}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Faturado (Ano)</span>
                  <div className="text-xl font-bold text-emerald-700 mt-1">14.850,20€</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">A Vencer (30 dias)</span>
                  <div className="text-xl font-bold text-amber-700 mt-1">0,00€</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Vencido</span>
                  <div className="text-xl font-bold text-red-700 mt-1">0,00€</div>
                </div>
              </div>

              {/* Ledger Action Toolbar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700">Documentos de Compra & Liquidações</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alert("A gerar extrato em formato PDF...")}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    Imprimir Extrato
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Abertura de formulário de pagamento...")}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    Novo Pagamento
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">Sem documentos pendentes</div>
                <div className="text-xs text-slate-500">Não existem faturas em aberto ou valores vencidos para este fornecedor.</div>
              </div>
            </div>
          )}

          {/* TAB 8: MORADAS E FILIAIS */}
          {activeTab === "filiais" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Plataformas, Depósitos & Filiais</h3>
                  <p className="text-xs text-slate-500">Delegações regionais de recolha e entrega</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Filial / Plataforma
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(formData.branches || []).map((br) => (
                  <div key={br.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2 relative group">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, branches: formData.branches?.filter((b) => b.id !== br.id) })}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono px-2 py-0.5 rounded">
                        {br.code}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800">{br.name}</h4>
                    </div>

                    <div className="text-xs text-slate-600 flex items-start gap-1.5 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{br.address}, {br.postal_code} {br.city}</span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{br.phone} • {br.email}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-1">
                      Responsável: <strong>{br.contact_person}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: CERTIFICADOS E VALIDADES */}
          {activeTab === "certificados" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Controlo de Conformidade & Validade de Documentos</h3>
                  <p className="text-xs text-slate-500">Alertas automáticos de expiração de licenças, seguros e certidões</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newCert: CertificateCompliance = {
                      id: `cert_${Date.now()}`,
                      title: "Novo Documento / Certificado",
                      doc_number: "DOC-2026-01",
                      issue_date: "2026-01-01",
                      expiry_date: "2027-01-01",
                      alert_days: 30,
                      notes: "Documentação de conformidade.",
                      status: "Válido"
                    }
                    setFormData({
                      ...formData,
                      certificates: [...(formData.certificates || DEFAULT_CERTIFICATES), newCert]
                    })
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Certificado
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 min-w-[220px]">Documento / Certificação</th>
                      <th className="py-3 px-4 min-w-[140px]">N.º Documento / Apólice</th>
                      <th className="py-3 px-4 w-28">Data Emissão</th>
                      <th className="py-3 px-4 w-28">Validade</th>
                      <th className="py-3 px-4 w-28">Alerta Prévio</th>
                      <th className="py-3 px-4 min-w-[200px]">Notas de Conformidade</th>
                      <th className="py-3 px-4 w-24 text-center">Estado</th>
                      <th className="py-3 px-4 w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.certificates || DEFAULT_CERTIFICATES).map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-800">{cert.title}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">{cert.doc_number}</td>
                        <td className="py-3 px-4 text-slate-600">{cert.issue_date}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{cert.expiry_date}</td>
                        <td className="py-3 px-4 text-slate-500">{cert.alert_days} dias antes</td>
                        <td className="py-3 px-4 text-slate-600">{cert.notes}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                            {cert.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              certificates: (formData.certificates || DEFAULT_CERTIFICATES).filter((c) => c.id !== cert.id)
                            })}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: DOCUMENTAÇÃO */}
          {activeTab === "documentacao" && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors cursor-pointer">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <div className="text-sm font-bold text-slate-700">Carregar Novo Anexo ou Contrato</div>
                  <div className="text-xs text-slate-500 mt-1">Arraste ficheiros em formato PDF, DOCX, XLSX ou digitalizações de contratos</div>
                  <button
                    type="button"
                    onClick={() => {
                      const newDoc: DocumentAttachment = {
                        id: `doc_${Date.now()}`,
                        name: "Contrato_Parceria_Correos_2026.pdf",
                        type: "PDF",
                        size_kb: 450,
                        upload_date: "2026-09-08",
                        uploaded_by: "Administrador"
                      }
                      setFormData({ ...formData, documents: [...(formData.documents || []), newDoc] })
                    }}
                    className="mt-3 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 shadow-3xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    Simular Carregamento
                  </button>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Ficheiros Anexados</h4>
                  {(formData.documents && formData.documents.length > 0) ? (
                    <div className="space-y-2">
                      {formData.documents.map((doc) => (
                        <div key={doc.id} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-red-500" />
                            <div>
                              <div className="text-xs font-bold text-slate-800">{doc.name}</div>
                              <div className="text-[11px] text-slate-400">{doc.size_kb} KB • Carregado em {doc.upload_date} por {doc.uploaded_by}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => alert(`A descarregar ${doc.name}...`)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, documents: formData.documents?.filter((d) => d.id !== doc.id) })}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-6">
                      Nenhum anexo guardado até ao momento.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>

        {/* ===================== FOOTER ACTION BAR ===================== */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Gravado com sucesso!
              </span>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">
              Linke TMS Core • Entidade Fornecedor: <strong>{formData.code}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initialData ? "Atualizar Fornecedor" : "Gravar Novo Fornecedor"}
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
