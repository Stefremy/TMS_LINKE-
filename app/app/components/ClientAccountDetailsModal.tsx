"use client"

import * as React from "react"
import { 
  Building2, 
  MapPin, 
  Phone, 
  Truck, 
  X, 
  CreditCard,
  Copy,
  Check
} from "lucide-react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"

interface ClientAccountDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  client: Cliente | null
  userAvatar?: string | null
}

type TabType = "geral" | "morada" | "contactos" | "comercial" | "servicos"

export function ClientAccountDetailsModal({
  isOpen,
  onClose,
  client,
  userAvatar
}: ClientAccountDetailsModalProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>("geral")
  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [servicosLinke, setServicosLinke] = React.useState<any[]>([])

  React.useEffect(() => {
    getServicosLinkeAction().then((res) => {
      if (res) setServicosLinke(res)
    })
  }, [])

  // Detect which carrier operators actually exist in the client's assigned price table
  const activeCarrierCodes = React.useMemo(() => {
    const codes = new Set<string>()
    const assignedIds = client?.assigned_linke_service_ids || []
    
    if (assignedIds.length > 0 && servicosLinke.length > 0) {
      assignedIds.forEach(id => {
        const srv = servicosLinke.find(s => s.id === id)
        if (srv) {
          const combined = `${srv.webservice_connection_id || ""} ${srv.preferred_carrier_id || ""} ${srv.preferred_carrier_name || ""} ${srv.name || ""}`.toLowerCase()
          if (combined.includes("ctt")) codes.add("ctt_expresso")
          if (combined.includes("correos")) codes.add("correos_express")
          if (combined.includes("dpd")) codes.add("dpd")
          if (combined.includes("mrw")) codes.add("mrw")
        }
      })
    }
    
    // Fallback: if no services matched, default to CTT and Correos only
    if (codes.size === 0) {
      codes.add("ctt_expresso")
      codes.add("correos_express")
    }
    return codes
  }, [client, servicosLinke])

  // Filter allowed webservices to ONLY those present in the client's actual pricing table
  const displayWebservices = React.useMemo(() => {
    const allowed = (client?.allowed_webservices && client.allowed_webservices.length > 0)
      ? client.allowed_webservices
      : [
          { id: "ws_ctt", code: "ctt_expresso", name: "CTT Expresso", is_enabled: true, is_default: true },
          { id: "ws_correos", code: "correos_express", name: "Correos Express", is_enabled: true, is_default: false },
        ]
    return allowed.filter(ws => ws.is_enabled && activeCarrierCodes.has(ws.code))
  }, [client, activeCarrierCodes])

  // Get full details of contracted services from the price table
  const contractedServices = React.useMemo(() => {
    if (!client?.assigned_linke_service_ids || servicosLinke.length === 0) return []
    return servicosLinke.filter(s => client.assigned_linke_service_ids?.includes(s.id))
  }, [client, servicosLinke])

  if (!isOpen || !client) return null

  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const avatarSrc = client.logo_url || userAvatar || null
  const initials = (client.short_name || client.legal_name || "CL").substring(0, 2).toUpperCase()
  const avatarBg = client.color || "var(--accent)"

  const tabs = [
    { id: "geral", label: "Identidade & Geral", icon: Building2 },
    { id: "morada", label: "Moradas & Sede", icon: MapPin },
    { id: "contactos", label: "Contactos", icon: Phone },
    { id: "comercial", label: "Condições & Saldo", icon: CreditCard },
    { id: "servicos", label: "Transportadoras", icon: Truck },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div 
        className="bg-[var(--surface-bg)] rounded-2xl shadow-[var(--shadow-layer)] w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-[var(--border-subtle)]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ===================== HEADER ===================== */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base text-white shrink-0 overflow-hidden shadow-2xs border border-[var(--border-subtle)]"
              style={{ backgroundColor: avatarBg }}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={avatarSrc} 
                  alt={client.short_name} 
                  className="w-full h-full object-cover bg-white" 
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {client.short_name}
                </h2>
                <span className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0">
                  {client.code}
                </span>
                <span className="bg-emerald-100/70 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Conta Ativa
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)] mt-0.5">
                <span className="truncate max-w-[200px]">{client.legal_name || "Loja do Cliente"}</span>
                {client.nif && (
                  <>
                    <span>•</span>
                    <span>NIF: <strong className="font-mono text-[var(--text-secondary)]">{client.nif}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== TABS NAVIGATION ===================== */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 px-4 sm:px-6 shrink-0 overflow-x-auto gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-bg)] shadow-2xs rounded-t-md"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)]/40 font-medium"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ===================== TAB CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[var(--canvas-bg)] space-y-4">
          
          {/* TAB 1: IDENTIDADE & GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Identificação Comercial & Fiscal
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Nome Comercial / Loja</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span>{client.short_name}</span>
                      <button onClick={() => copyToClipboard(client.short_name, "short_name")} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        {copiedField === "short_name" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Razão Social / Nome Fiscal</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-medium">
                      {client.legal_name || "—"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">NIF / Número Fiscal</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span>{client.nif || "—"}</span>
                      {client.nif && (
                        <button onClick={() => copyToClipboard(client.nif, "nif")} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                          {copiedField === "nif" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Código de Conta</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[var(--text-primary)]">
                      {client.code}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Categoria de Cliente</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-medium">
                      {client.category || "Cliente Geral"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Data de Adesão</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-medium">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-PT") : "Ativo"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MORADA & SEDE */}
          {activeTab === "morada" && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Sede & Local de Recolha Padrão
                </h3>

                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Morada Principal / Rua</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-medium text-[var(--text-primary)]">
                      {client.address || "Morada não configurada"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Código Postal</span>
                      <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[var(--text-primary)]">
                        {client.postal_code || "—"}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Localidade / Cidade</span>
                      <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-medium text-[var(--text-primary)]">
                        {client.city || "Portugal"}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">País</span>
                      <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-medium text-[var(--text-primary)]">
                        {client.country_code === "ES" ? "Espanha" : "Portugal"} ({client.country_code || "PT"})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTOS */}
          {activeTab === "contactos" && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <Phone className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Canais de Contacto & Responsáveis
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Email Principal</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-medium flex items-center justify-between">
                      <span className="truncate">{client.email || "—"}</span>
                      {client.email && (
                        <button onClick={() => copyToClipboard(client.email, "email")} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                          {copiedField === "email" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Email de Faturação</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] font-medium truncate">
                      {client.billing_email || client.email || "—"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Telefone Fixo</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono text-[var(--text-primary)]">
                      {client.phone || "—"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Telemóvel Operacional</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[var(--text-primary)]">
                      {client.mobile_phone || "—"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Gestor / Responsável da Loja</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-medium text-[var(--text-primary)]">
                      {client.manager_name || "—"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Comercial Linke Atribuído</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-medium text-[var(--text-primary)]">
                      {client.assigned_seller || "Gestão Geral Linke"}
                    </div>
                  </div>
                </div>

                {client.observations && (
                  <div className="pt-2">
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Notas / Observações Operacionais</span>
                    <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-secondary)] leading-relaxed italic">
                      "{client.observations}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: COMERCIAL & SALDO */}
          {activeTab === "comercial" && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <CreditCard className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Condições Financeiras & Faturação
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl">
                    <span className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">Modelo de Faturação</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {client.billing_type === "pay_as_you_go" ? "Pré-Pagamento (Wallet)" : "Conta Corrente (Pós-Pago)"}
                    </span>
                  </div>

                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl">
                    <span className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">Condições de Pagamento</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {client.payment_terms || "A 30 dias"}
                    </span>
                  </div>

                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl">
                    <span className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1">Agência de Faturação</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {client.billing_agency || "A01 - Sede Guimarães"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">IBAN para Reembolsos (COD)</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-mono font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span className="truncate">{client.iban || "PT50 0000 0000 0000 0000 0000 0"}</span>
                      {client.iban && (
                        <button onClick={() => copyToClipboard(client.iban!, "iban")} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                          {copiedField === "iban" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Limite de Crédito Concedido</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-bold text-[var(--text-primary)]">
                      {client.credit_limit ? `${client.credit_limit.toFixed(2)}€` : "Sem Limite Definido"}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Desconto Contratual</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-bold text-emerald-700">
                      {client.pricing?.discount_pct ?? client.volume_discount_pct ?? 0}% de desconto base
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Taxa de Combustível Aplicável</span>
                    <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg font-bold text-[var(--text-primary)]">
                      {client.pricing?.fuel_surcharge_pct ? `${client.pricing.fuel_surcharge_pct}%` : "12.5% (Tabela Geral)"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SERVIÇOS & TRANSPORTADORAS */}
          {activeTab === "servicos" && (
            <div className="space-y-4">
              <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <Truck className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Operadores Integrados & Webservices Autorizados
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayWebservices.map((ws) => (
                    <div 
                      key={ws.id}
                      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 bg-[var(--surface-muted)] border-[var(--border-subtle)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white p-1 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={getCarrierLogo(ws.code) || getCarrierLogo("ctt") || ""} 
                            alt={ws.name} 
                            className="max-w-full max-h-full object-contain" 
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-[var(--text-primary)] block truncate">{ws.name}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">
                            {ws.is_default ? "Transportadora Predefinida" : "Transportadora Integrada"}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-800">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>

                {contractedServices.length > 0 && (
                  <div className="pt-2">
                    <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
                      Serviços Contratados na Tabela de Preços ({contractedServices.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contractedServices.map((srv) => (
                        <div 
                          key={srv.id} 
                          className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded bg-white p-0.5 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={getCarrierLogo(srv.preferred_carrier_name || srv.preferred_carrier_id || "ctt") || ""} 
                                alt="Logo" 
                                className="max-w-full max-h-full object-contain" 
                              />
                            </div>
                            <span className="font-semibold text-[var(--text-primary)] truncate text-[11px]">
                              {srv.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.2 rounded shrink-0">
                            {srv.transit_time_label || "24h"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <span className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Perfil de Tabela Linke</span>
                  <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg text-xs font-semibold text-[var(--text-primary)]">
                    {client.assigned_linke_profile || "Standard / Geral"}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ===================== FOOTER ===================== */}
        <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-[var(--text-tertiary)] hidden sm:inline">
            Linke TMS • Informação de Conta Cliente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ml-auto"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  )
}
