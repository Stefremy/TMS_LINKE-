"use client"

import { CLIENT_ACTIVITY_COLORS, clientActivityColor } from "@/lib/clients/activity-color"
import { CountrySelect } from "@/components/country-select"
import { normalizeClientBillingFields, usesPrincipalBillingAddress, getClientBillingAddress } from "@/lib/client-addresses"

import * as React from "react"
import { ClientPortalAccessControl } from './ClientPortalAccessControl'
import { ClientServiceHistory } from './ClientServiceHistory'
import { 
  X, 
  Save, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Palette, 
  Loader2, 
  CheckCircle2, 
  Euro, 
  FileText, 
  User, 
  ShieldAlert, 
  ExternalLink, 
  Layers,
  Percent,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Sliders,
  Tag,
  Clock,
  Plane,
  Anchor,
  HelpCircle,
  Zap,
  ShieldCheck,
  Package,
  SlidersHorizontal,
  ArrowRight,
  Upload,
  Image as ImageIcon,
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { saveClienteAction } from "@/app/actions/clientes"
import { inviteClientAccessAction } from "@/app/actions/client-invitations"
import { paymentDueDays } from "@/lib/billing/payment-terms"
import { normalizeStoreSlug } from "@/lib/client-portal/paths"
import { getServiceZoneOverrideKey, resolveZoneTierOverrides } from "@/lib/pricing/calculate-shipment-price"
import { isPrimordialServico } from "@/app/ops/configuracao/servicos/types"
import type { ServicoLinke, PriceTierLinke, ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"
import { CttServiceBadge } from "@/components/ctt-service-badge"
import { CORREOS_INCLUDED_SERVICES, isCorreosConfigurationOnly, mergeClientSpecialFees } from "@/lib/services/correos/complementary-services"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { 
  Cliente, 
  DEFAULT_CLIENT_CATEGORIES, 
  CLIENT_COLOR_OPTIONS,
  DEFAULT_CLIENT_PRICING,
  DEFAULT_CTT_SPECIAL_SERVICES_FEES,
  ClientPricingConfig,
  ClientSpecialServiceFee
} from "../types"

interface ClienteModalProps {
  initialData?: Cliente | null
  servicosLinke?: ServicoLinke[]
  canManageAccess?: boolean
  canSendAccessEmail?: boolean
  defaultPaymentDays?: number
  onManageAccess?: () => void
  onClose: () => void
  onSaved: (saved: Cliente) => void
}

type TabType = "geral" | "faturacao" | "contactos" | "comercial" | "precario" | "acesso"
type PrecarioSubTab = "servicos_linke" | "suplementares" | "geral"

export function ClienteModal({ initialData, servicosLinke = [], canManageAccess = false, canSendAccessEmail = canManageAccess, defaultPaymentDays = 30, onManageAccess, onClose, onSaved }: ClienteModalProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabType>("geral")
  const [precarioSubTab, setPrecarioSubTab] = React.useState<PrecarioSubTab>("servicos_linke")
  const [serviceTableFilter, setServiceTableFilter] = React.useState<"all" | "base" | "custom">("all")
  const [specialProviderTab, setSpecialProviderTab] = React.useState<"ctt" | "correos">("ctt")
  const [savedFormSnapshot, setSavedFormSnapshot] = React.useState<string | null>(null)
  const [draftId] = React.useState(() => initialData?.id || crypto.randomUUID())
  const [sendInvitation, setSendInvitation] = React.useState(false)
  const [invitationEmail, setInvitationEmail] = React.useState("")
  const [invitationMessage, setInvitationMessage] = React.useState("")
  const [saveError, setSaveError] = React.useState("")

  // Initialize form data with rich pricing and webservices
  const [formData, setFormData] = React.useState<Partial<Cliente>>({
    code: initialData?.code || `CL${Math.floor(100 + Math.random() * 900)}`,
    short_name: initialData?.short_name || "",
    portal_slug: initialData?.portal_slug || "",
    legal_name: initialData?.legal_name || "",
    color: initialData?.color || "#246B45",
    color_mode: initialData?.color_mode,
    logo_url: initialData?.logo_url || "",
    nif: initialData?.nif || "",
    category: initialData?.category || "Cliente Conta Corrente",
    billing_type: initialData?.billing_type || "conta_corrente",
    city: initialData?.city || "",
    address: initialData?.address || "",
    postal_code: initialData?.postal_code || "",
    country_code: initialData?.country_code || "PT",
    ...normalizeClientBillingFields(initialData || {}),
    email: initialData?.email || "",
    billing_email: initialData?.billing_email || "",
    phone: initialData?.phone || "",
    mobile_phone: initialData?.mobile_phone || "",
    manager_name: initialData?.manager_name || "",
    billing_agency: initialData?.billing_agency || "A01 - Sede Guimarães",
    payment_terms: initialData?.payment_terms || "A 30 dias",
    payment_due_days: initialData?.payment_due_days ?? defaultPaymentDays,
    iban: initialData?.iban || "",
    credit_limit: initialData?.credit_limit ?? 5000,
    credit_limit_enabled: initialData?.credit_limit_enabled ?? false,
    balance: initialData?.balance || "0,00€",
    assigned_seller: initialData?.assigned_seller || "Gestão Comercial",
    observations: initialData?.observations || "",
    is_active: initialData?.is_active ?? true,
    created_at: initialData?.created_at || new Date().toISOString(),
    default_linke_table_id: initialData?.default_linke_table_id || "",
    assigned_linke_service_ids: initialData?.assigned_linke_service_ids ?? (initialData ? servicosLinke.map((s) => s.id) : []),
    assigned_linke_profile: initialData?.assigned_linke_profile || "Standard / Geral",
    volume_discount_pct: initialData?.volume_discount_pct ?? 0,
    pricing: {
      ...DEFAULT_CLIENT_PRICING, ...initialData?.pricing,
      special_services_fees: mergeClientSpecialFees(initialData?.pricing?.special_services_fees, DEFAULT_CTT_SPECIAL_SERVICES_FEES),
    },
    custom_tier_overrides: initialData?.custom_tier_overrides || {},
  })

  const saveSuccessMsg = savedFormSnapshot === JSON.stringify(formData) && !sendInvitation

  const [expandedPriceServico, setExpandedPriceServico] = React.useState<string | null>(null)
  const [activeZoneByServico, setActiveZoneByServico] = React.useState<Record<string, number>>({})
  const [quickDiscountPct, setQuickDiscountPct] = React.useState<number>(10)
  const [isEditingCredit, setIsEditingCredit] = React.useState(false)

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        code: initialData.code || "",
        short_name: initialData.short_name || "",
        portal_slug: initialData.portal_slug || "",
        legal_name: initialData.legal_name || "",
        color: initialData.color || "#246B45",
        color_mode: initialData.color_mode,
        logo_url: initialData.logo_url || "",
        nif: initialData.nif || "",
        category: initialData.category || "Cliente Conta Corrente",
        billing_type: initialData.billing_type || "conta_corrente",
        city: initialData.city || "",
        address: initialData.address || "",
        postal_code: initialData.postal_code || "",
        country_code: initialData.country_code || "PT",
        ...normalizeClientBillingFields(initialData),
        email: initialData.email || "",
        billing_email: initialData.billing_email || "",
        phone: initialData.phone || "",
        mobile_phone: initialData.mobile_phone || "",
        manager_name: initialData.manager_name || "",
        billing_agency: initialData.billing_agency || "A01 - Sede Guimarães",
        payment_terms: initialData.payment_terms || "A 30 dias",
        payment_due_days: initialData.payment_due_days ?? defaultPaymentDays,
        iban: initialData.iban || "",
        credit_limit: initialData.credit_limit ?? 5000,
        credit_limit_enabled: initialData.credit_limit_enabled ?? false,
        balance: initialData.balance || "0,00€",
        assigned_seller: initialData.assigned_seller || "Gestão Comercial",
        observations: initialData.observations || "",
        is_active: initialData.is_active ?? true,
        created_at: initialData.created_at || new Date().toISOString(),
        default_linke_table_id: initialData.default_linke_table_id || "",
        assigned_linke_service_ids: initialData.assigned_linke_service_ids || servicosLinke.map((s) => s.id),
        assigned_linke_profile: initialData.assigned_linke_profile || "Standard / Geral",
        volume_discount_pct: initialData.volume_discount_pct ?? 0,
        custom_tier_overrides: initialData.custom_tier_overrides || {},
        pricing: {
          ...DEFAULT_CLIENT_PRICING,
          ...initialData.pricing,
          special_services_fees: mergeClientSpecialFees(initialData.pricing?.special_services_fees, DEFAULT_CTT_SPECIAL_SERVICES_FEES),
        },
      })
    }
  }, [initialData, servicosLinke, defaultPaymentDays])

  React.useEffect(() => {
    if (formData.billing_type === "pay_as_you_go" && formData.payment_terms !== "Pronto Pagamento") {
      setFormData(prev => ({ ...prev, payment_terms: "Pronto Pagamento" }))
    }
  }, [formData.billing_type, formData.payment_terms])

  // Handlers for Special Services Fees
  const handleSpecialFeeChange = (index: number, field: keyof ClientSpecialServiceFee, value: any) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      const currentList = currentPricing.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES
      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        [field]: typeof value === "boolean" ? value : typeof value === "string" && !isNaN(Number(value)) ? parseFloat(value) : value,
      }
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          special_services_fees: updated,
        },
      }
    })
  }

  const handlePricingConfigChange = (field: keyof ClientPricingConfig, value: any) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          [field]: value,
        },
      }
    })
  }

  const handleTierPriceChange = (
    servico: ServicoLinke,
    zoneCode: string,
    tierIndex: number,
    newSellPrice: number,
    baseTiers: PriceTierLinke[]
  ) => {
    setFormData((prev) => {
      const existing = resolveZoneTierOverrides(prev.custom_tier_overrides, servico, zoneCode)
      const currentOverrides = existing ? [...existing] : baseTiers.map((t) => t.sell_price)

      while (currentOverrides.length < baseTiers.length) {
        currentOverrides.push(baseTiers[currentOverrides.length].sell_price)
      }

      currentOverrides[tierIndex] = newSellPrice

      const nextOverrides = { ...(prev.custom_tier_overrides || {}) }
      nextOverrides[getServiceZoneOverrideKey(servico.id, zoneCode)] = currentOverrides
      if (servico.zones?.[0]?.zone_code === zoneCode && servico.id in nextOverrides) {
        delete nextOverrides[servico.id]
      }

      return {
        ...prev,
        custom_tier_overrides: nextOverrides,
      }
    })
  }

  const handleApplyZoneDiscount = (
    servico: ServicoLinke,
    targetZones: ZonePriceMatrix[],
    discountPct: number
  ) => {
    const pct = Number.isFinite(discountPct) ? Math.max(-100, Math.min(80, discountPct)) : 0
    setFormData((prev) => {
      const nextOverrides = { ...(prev.custom_tier_overrides || {}) }
      for (const z of targetZones) {
        const discounted = (z.tiers || []).map((t) => {
          const factor = 1 - pct / 100
          const minSafe = Number((t.cost_price * 1.02).toFixed(2))
          const candidate = Number((t.sell_price * factor).toFixed(2))
          return Math.max(0.01, pct > 0 ? Math.max(minSafe, candidate) : candidate)
        })
        nextOverrides[getServiceZoneOverrideKey(servico.id, z.zone_code)] = discounted
        if (servico.zones?.[0]?.zone_code === z.zone_code && servico.id in nextOverrides) {
          delete nextOverrides[servico.id]
        }
      }
      return {
        ...prev,
        custom_tier_overrides: nextOverrides,
      }
    })
  }

  const handleResetZoneTiers = (servico: ServicoLinke, zoneCode: string) => {
    setFormData((prev) => {
      const nextOverrides = { ...(prev.custom_tier_overrides || {}) }
      delete nextOverrides[getServiceZoneOverrideKey(servico.id, zoneCode)]
      if (servico.zones?.[0]?.zone_code === zoneCode) {
        delete nextOverrides[servico.id]
      }
      return {
        ...prev,
        custom_tier_overrides: nextOverrides,
      }
    })
  }

  const handleResetServiceTiers = (servico: ServicoLinke) => {
    setFormData((prev) => {
      const nextOverrides = { ...(prev.custom_tier_overrides || {}) }
      delete nextOverrides[servico.id]
      const prefix = `${servico.id}::`
      for (const key of Object.keys(nextOverrides)) {
        if (key.startsWith(prefix)) delete nextOverrides[key]
      }
      return {
        ...prev,
        custom_tier_overrides: nextOverrides,
      }
    })
  }

  const handleResetPricing = () => {
    if (confirm("Repor taxas adicionais, combustível, desconto geral e escalões personalizados para os valores padrão? Os serviços autorizados e os preços definidos por serviço serão mantidos.")) {
      setFormData((prev) => ({
        ...prev,
        pricing: {
          ...DEFAULT_CLIENT_PRICING,
          services_pricing: prev.pricing?.services_pricing ?? DEFAULT_CLIENT_PRICING.services_pricing,
        },
        custom_tier_overrides: {},
      }))
    }
  }


  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada não deve exceder 2MB.")
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          setFormData((prev) => ({ ...prev, logo_url: result }))
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSaving) return
    if (!formData.short_name?.trim()) {
      alert("Por favor preencha a Designação Curta / Nome do Cliente.")
      setActiveTab("geral")
      return
    }

    if (sendInvitation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitationEmail.trim())) {
      setSaveError("Indique o email do cliente para enviar o convite.")
      setActiveTab("geral")
      return
    }
    setSaveError("")
    setInvitationMessage("")
    setIsSaving(true)
    let persisted = false
    const submittedSnapshot = JSON.stringify(formData)
    try {
      paymentDueDays(formData.payment_due_days, NaN)
      const res = await saveClienteAction({
        ...formData,
        id: initialData?.id || draftId,
      })

      if (res.success && res.data) {
        persisted = true
        setSavedFormSnapshot(submittedSnapshot)
        onSaved(res.data)
        if (sendInvitation) {
          const invitation = await inviteClientAccessAction(res.data.id, invitationEmail)
          setInvitationMessage(invitation.message)
          setSendInvitation(false)
          return // Keep the invitation delivery result visible.
        }
      } else {
        setSaveError("error" in res && typeof res.error === "string" ? res.error : "Não foi possível gravar o cliente. Tente novamente.")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente."
      setSaveError(`${persisted ? "Loja gravada, mas o convite não foi enviado: " : "Erro ao gravar cliente: "}${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const specialFeesList = formData.pricing?.special_services_fees || DEFAULT_CLIENT_PRICING.special_services_fees
  const assignedServices = servicosLinke.filter(service =>
    (formData.assigned_linke_service_ids || []).includes(service.id))
  // Inactive catalogue tables cannot be newly assigned; already-assigned ones stay visible so they can be removed.
  const unassignedServices = servicosLinke.filter(service =>
    service.is_active !== false && !(formData.assigned_linke_service_ids || []).includes(service.id))
  const selectableServicesCount = servicosLinke.filter(service =>
    service.is_active !== false || (formData.assigned_linke_service_ids || []).includes(service.id)).length
  const matchesTableFilter = (service: ServicoLinke) => serviceTableFilter === "all" ||
    (serviceTableFilter === "base" ? isPrimordialServico(service) : !isPrimordialServico(service))
  const filteredAssignedServices = assignedServices.filter(matchesTableFilter)
  const unassignedServiceGroups = [
    { id: "base", label: "Adicionar serviços · Tabelas primordiais", services: unassignedServices.filter(isPrimordialServico) },
    { id: "custom", label: "Adicionar serviços · Tabelas personalizadas", services: unassignedServices.filter(service => !isPrimordialServico(service)) },
  ]
  const updateServiceAuthorization = (service: ServicoLinke, authorize: boolean) => {
    if (!authorize && !confirm(`Remover a autorização de «${service.name}» para este cliente? O cliente deixará de poder criar envios com este serviço após gravar. A tabela e os preços personalizados serão mantidos.`)) return
    setFormData(prev => ({
      ...prev,
      assigned_linke_service_ids: authorize
        ? [...new Set([...(prev.assigned_linke_service_ids || []), service.id])]
        : (prev.assigned_linke_service_ids || []).filter(id => id !== service.id),
      default_linke_table_id: !authorize && prev.default_linke_table_id === service.id ? "" : prev.default_linke_table_id,
    }))
    if (!authorize && expandedPriceServico === service.id) setExpandedPriceServico(null)
  }
  const visibleAssignedTablesCount = assignedServices.length
  const activeSpecialFeesCount = specialFeesList.filter((fee) => fee.is_enabled).length

  const renderServiceAuthorization = (servico: ServicoLinke) => {
    const isAssigned = (formData.assigned_linke_service_ids || []).includes(servico.id)
    const carrierLogo = getCarrierLogo(servico.preferred_carrier_name)
    const zonesList: ZonePriceMatrix[] = servico.zones || []
    const selectedZoneIdx = Math.min(activeZoneByServico[servico.id] || 0, Math.max(0, zonesList.length - 1))
    const activeZone = zonesList[selectedZoneIdx] || zonesList[0]
    const tiers: PriceTierLinke[] = activeZone?.tiers || []
    const firstZone = zonesList[0]
    const firstZoneTiers: PriceTierLinke[] = firstZone?.tiers || []
    const tier1 = firstZoneTiers[0]
    const tier5 = firstZoneTiers.find((t) => t.weight_max === 5) || firstZoneTiers[1]
    const isExpanded = expandedPriceServico === servico.id
    const activeZoneOverrides = activeZone
      ? resolveZoneTierOverrides(formData.custom_tier_overrides, servico, activeZone.zone_code)
      : undefined
    const zoneHasCustomPrices = (zone: ZonePriceMatrix) => {
      const zOverrides = resolveZoneTierOverrides(formData.custom_tier_overrides, servico, zone.zone_code)
      return !!(
        zOverrides &&
        zOverrides.some((val, idx) => val !== undefined && zone.tiers?.[idx] && Math.abs(val - zone.tiers[idx].sell_price) > 0.001)
      )
    }
    const activeZoneIsCustom = activeZone ? zoneHasCustomPrices(activeZone) : false
    const hasCustomPrices = zonesList.some((z) => zoneHasCustomPrices(z))

    return (
      <div
        key={servico.id}
        className={`rounded-xl border transition-all ${
          isExpanded ? "col-span-1 md:col-span-2 shadow-sm ring-1 ring-[var(--accent)]/30" : "col-span-1 shadow-xs"
        } ${
          isAssigned
            ? hasCustomPrices
              ? "bg-amber-50/20 border-amber-400"
              : "bg-[var(--accent-soft)]/40 border-[var(--accent)] ring-1 ring-[var(--accent)]/20"
            : "bg-[var(--surface-bg)] border-[var(--border-subtle)] opacity-60 hover:opacity-100"
        }`}
      >
        <div className="p-3 flex flex-col gap-2">
          <div className="flex w-full min-w-0 items-start gap-2">
            {isAssigned && <CheckCircle2 aria-label="Serviço autorizado" className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                {carrierLogo ? (
                  <div className="w-6 h-6 rounded bg-[var(--surface-bg)] border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={carrierLogo} alt={servico.preferred_carrier_name} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : null}
                <span className="font-bold text-xs leading-snug text-[var(--text-primary)]">{servico.name}</span>
                <CttServiceBadge service={servico} />
                <span className="rounded border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  {isPrimordialServico(servico) ? "Tabela mãe · Primordial" : "Tabela personalizada"}
                </span>
                {servico.is_active === false && <span className="text-[10px] font-medium text-[var(--text-secondary)]">Inativo no catálogo</span>}
                {zonesList.length > 1 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {zonesList.length} Zonas
                  </span>
                )}
                {hasCustomPrices && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Edit3 className="w-2.5 h-2.5" />
                    Preços ajustados neste cliente
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span className="whitespace-nowrap text-[10px] font-mono text-[var(--text-tertiary)]">{servico.code}</span>
                <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.2 rounded border border-[var(--accent)]/20">
                  {servico.pricing_profile}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">Trânsito: {servico.transit_time_label}</span>
              </div>

              {tier1 && !isExpanded && (
                <div className="mt-1.5 text-[11px] text-[var(--text-secondary)] flex items-center gap-2 font-mono flex-wrap">
                  {zonesList.length > 1 ? (
                    <>
                      {zonesList.slice(0, 3).map((z, zIdx) => {
                        const zTier1 = z.tiers?.[0]
                        if (!zTier1) return null
                        const zOvr = resolveZoneTierOverrides(formData.custom_tier_overrides, servico, z.zone_code)
                        const zPrice1 = zOvr?.[0] ?? zTier1.sell_price
                        const zCustom = zOvr?.[0] !== undefined && Math.abs(zOvr[0] - zTier1.sell_price) > 0.001
                        return (
                          <span key={z.zone_code}>
                            {zIdx > 0 ? "• " : ""}
                            {z.zone_code} ({zTier1.label}):{" "}
                            <strong className={zCustom ? "text-amber-800 font-bold" : "text-[var(--accent)] font-bold"}>
                              {zPrice1.toFixed(2)}€
                            </strong>
                          </span>
                        )
                      })}
                      {zonesList.length > 3 && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          +{zonesList.length - 3} zonas
                        </span>
                      )}
                    </>
                  ) : (() => {
                     const firstOverrides = firstZone ? resolveZoneTierOverrides(formData.custom_tier_overrides, servico, firstZone.zone_code) : undefined
                     const price1 = firstOverrides?.[0] ?? tier1.sell_price
                     const is1Custom = firstOverrides?.[0] !== undefined && Math.abs(firstOverrides[0] - tier1.sell_price) > 0.001
                     const price5 = tier5 ? (firstOverrides?.[firstZoneTiers.indexOf(tier5)] ?? tier5.sell_price) : null
                     return (
                       <>
                         <span>
                           Até 1kg:{" "}
                           <strong className={is1Custom ? "text-amber-800 font-bold" : "text-[var(--accent)] font-bold"}>
                             {price1.toFixed(2)}€
                           </strong>
                           {is1Custom && (
                             <span className="text-[9px] text-[var(--text-tertiary)] line-through ml-1">
                               {tier1.sell_price.toFixed(2)}€
                             </span>
                           )}
                         </span>
                         {tier5 && price5 !== null && (
                           <span>
                             • Até 5kg:{" "}
                             <strong className="text-[var(--accent)] font-bold">
                               {price5.toFixed(2)}€
                             </strong>
                           </span>
                         )}
                       </>
                     )
                   })()}
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2" onClick={(e) => e.stopPropagation()}>
            {isAssigned && zonesList.some((z) => (z.tiers?.length || 0) > 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedPriceServico(isExpanded ? null : servico.id)
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isExpanded
                    ? "bg-[var(--text-primary)] text-white border-[var(--text-primary)]"
                    : hasCustomPrices
                    ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                    : "bg-[var(--surface-bg)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>{isExpanded ? "Fechar Tabela" : hasCustomPrices ? "Ajustar Preços ✎" : "Ajustar Preços"}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            <button type="button" onClick={() => updateServiceAuthorization(servico, !isAssigned)}
              aria-label={`${isAssigned ? "Remover autorização de" : "Autorizar"} ${servico.name}`}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${isAssigned
                ? "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)]/70"}`}>
              {isAssigned ? "Remover autorização" : "Autorizar"}
            </button>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isAssigned ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30" : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
            }`}>
              {isAssigned ? "Autorizado" : "Não autorizado"}
            </span>
          </div>
        </div>

        {/* Expanded Price Override Table */}
        {isExpanded && isAssigned && activeZone && (
          <div
            className="p-4 bg-[var(--surface-bg)] border-t border-[var(--border-subtle)] rounded-b-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Personalização por Zona & Escalão: {servico.name}
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Zona ativa: <strong>{activeZone.zone_name || activeZone.zone_code}</strong> (antes de combustível e extras). Na Área do Cliente a zona é aplicada automaticamente pelo país de destino.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeZoneIsCustom && zonesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleResetZoneTiers(servico, activeZone.zone_code)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Repor {activeZone.zone_code}
                  </button>
                )}
                {hasCustomPrices && (
                  <button
                    type="button"
                    onClick={() => handleResetServiceTiers(servico)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {zonesList.length > 1 ? "Repor Todas as Zonas" : "Repor Padrão Linke"}
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Zone Selector Tabs (e.g. Zona 2 | Zona 3 on Guia CE) */}
            {zonesList.length > 1 && (
              <div
                role="tablist"
                aria-label={`Zonas tarifárias de ${servico.name}`}
                className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]"
              >
                {zonesList.map((zone, zIdx) => {
                  const isCurrentZone = zIdx === selectedZoneIdx
                  const isZoneCustomized = zoneHasCustomPrices(zone)
                  return (
                    <button
                      key={zone.zone_code}
                      type="button"
                      role="tab"
                      aria-selected={isCurrentZone}
                      onClick={() => setActiveZoneByServico((prev) => ({ ...prev, [servico.id]: zIdx }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isCurrentZone
                          ? "bg-[var(--text-primary)] text-white shadow-2xs"
                          : "bg-[var(--surface-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      <span>{zone.zone_code}</span>
                      {zone.zone_name && zone.zone_name !== zone.zone_code && (
                        <span className={`text-[10px] font-normal hidden sm:inline truncate max-w-[180px] ${isCurrentZone ? "text-white/75" : "text-[var(--text-tertiary)]"}`}>
                          — {zone.zone_name.replace(new RegExp(`^${zone.zone_code}\\s*[—-]\\s*`), "")}
                        </span>
                      )}
                      {isZoneCustomized && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isCurrentZone ? "bg-amber-400 text-amber-950" : "bg-amber-100 text-amber-900"}`}>
                          Custom
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quick Discount / Batch Adjustment Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)] text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                  <Percent className="w-3 h-3 text-[var(--accent)]" />
                  Desconto rápido sobre PVP Linke:
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="-50"
                    max="60"
                    aria-label={`Percentagem de desconto rápido para ${servico.name}`}
                    value={quickDiscountPct}
                    onChange={(e) => setQuickDiscountPct(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)]"
                  />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">%</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyZoneDiscount(servico, [activeZone], quickDiscountPct)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--surface-bg)] hover:bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                >
                  Aplicar em {activeZone.zone_code}
                </button>
                {zonesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleApplyZoneDiscount(servico, zonesList, quickDiscountPct)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors cursor-pointer"
                  >
                    Aplicar nas {zonesList.length} Zonas
                  </button>
                )}
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-label={`Escalões de peso ${servico.name} — ${activeZone.zone_code}`}
              className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-[11px]">
                    <th className="py-2 px-3">Escalão</th>
                    <th className="py-2 px-3 text-center">Peso Máx</th>
                    <th className="py-2 px-3 text-right">Custo Parceiro</th>
                    <th className="py-2 px-3 text-right">PVP Standard Linke</th>
                    <th className="py-2 px-3 text-right bg-[var(--accent-soft)]/50 text-[var(--text-primary)] border-x border-[var(--border-subtle)]">
                      PVP Cliente (€) <span className="text-[var(--accent)] font-normal">(Editável)</span>
                    </th>
                    <th className="py-2 px-3 text-right">Margem Bruta</th>
                    <th className="py-2 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tiers.map((tier, tIdx) => {
                    const currentVal = activeZoneOverrides?.[tIdx] !== undefined ? activeZoneOverrides[tIdx] : tier.sell_price
                    const isOverridden = activeZoneOverrides?.[tIdx] !== undefined && Math.abs(activeZoneOverrides[tIdx] - tier.sell_price) > 0.001
                    const marginEur = currentVal - tier.cost_price
                    const marginPct = currentVal > 0 ? (marginEur / currentVal) * 100 : 0

                    return (
                      <tr key={tier.id || tIdx} className={`hover:bg-[var(--surface-muted)]/60 transition-colors ${isOverridden ? "bg-amber-50/40" : ""}`}>
                        <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                          {tier.label || `Escalão ${tIdx + 1}`}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                          ≤ {tier.weight_max} kg
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[var(--text-tertiary)]">
                          {tier.cost_price.toFixed(2)}€
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[var(--text-secondary)]">
                          {tier.sell_price.toFixed(2)}€
                        </td>
                        <td className="py-1.5 px-3 text-right bg-[var(--accent-soft)]/30 border-x border-[var(--border-subtle)]">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`PVP Cliente ${tier.label || `Escalão ${tIdx + 1}`} (${activeZone.zone_code})`}
                              value={currentVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                handleTierPriceChange(servico, activeZone.zone_code, tIdx, val, tiers)
                              }}
                              className={`w-24 text-right font-mono font-bold text-xs px-2 py-1 rounded-md border shadow-2xs focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-all ${
                                isOverridden
                                  ? "border-amber-400 bg-amber-50/90 text-amber-950 ring-1 ring-amber-400/40"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] focus:border-[var(--border-strong)]"
                              }`}
                            />
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">€</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          <span className={marginEur >= 0 ? "text-[var(--accent)] font-semibold" : "text-rose-600 font-bold"}>
                            {marginEur >= 0 ? "+" : ""}{marginEur.toFixed(2)}€
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)] block">
                            ({marginPct.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isOverridden ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Edit3 className="w-2.5 h-2.5" />
                              Custom
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                              Standard
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface-bg)] rounded-xl shadow-[var(--shadow-layer)] w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-[var(--border-subtle)]">
        
        {/* ===================== OVERVIEW HEADER ===================== */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div 
              className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-black text-base shadow-2xs shrink-0 overflow-hidden relative border border-[var(--border-subtle)]"
              style={{ backgroundColor: formData.color || "#246B45" }}
            >
              {formData.logo_url ? (
                <img 
                  src={formData.logo_url} 
                  alt={formData.short_name || "Logo"} 
                  className="w-full h-full object-cover bg-white"
                />
              ) : (
                formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {formData.short_name || (initialData ? "Editar Cliente" : "Novo Cliente")}
                </h1>
                
                <span className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-mono font-bold px-2 py-0.5 rounded shrink-0">
                  {formData.code || "CL000"}
                </span>

                <span className="bg-[#EEF3EF] border border-[#C9D7CD] text-[#315B43] text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  {formData.category || "Cliente Conta Corrente"}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                <span className="text-[var(--text-secondary)] font-medium truncate">
                  {formData.legal_name || "Designação Social / Fiscal"}
                </span>
                <span>•</span>
                <span>NIF: <strong className="text-[var(--text-primary)] font-mono">{formData.nif || "—"}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Redirect to Client Store / Portal UI */}
            <a
              href={`/app/selecionar?clientId=${encodeURIComponent(formData.id || "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] text-white rounded-md text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Aceder à loja / portal do cliente para criar novos envios e pedidos"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aceder à Loja (Criar Envios)</span>
              <span className="sm:hidden">Loja</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== TABS NAVIGATION ===================== */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/70 px-4 sm:px-6 shrink-0 overflow-x-auto gap-1">
          {[
            { id: "geral", label: "Identidade & Geral", icon: Building2 },
            { id: "faturacao", label: "Moradas & Faturação", icon: MapPin },
            { id: "contactos", label: "Contactos", icon: Phone },
            { id: "comercial", label: "Condições & Crédito", icon: Euro },
            { id: "precario", label: "Preços & Serviços", icon: Percent, badge: `${visibleAssignedTablesCount} serviços` },
            ...((canManageAccess || canSendAccessEmail) ? [{ id: "acesso", label: "Acesso à Área do Cliente", icon: ShieldCheck }] : []),
          ].map((tab) => {
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
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-dim)] text-[var(--text-secondary)]"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ===================== FORM CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--canvas-bg)]">
          {saveError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          {invitationMessage && <p role="status" className="mb-4 rounded-lg border border-[#C9D7CD] bg-[#F4F7F4] p-3 text-sm text-[#315B43]">{invitationMessage}</p>}
          
          {/* TAB 1: IDENTIDADE & GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              {initialData?.id && <ClientServiceHistory key={initialData.id} clientId={initialData.id} />}
              {!initialData && canSendAccessEmail && <div className="rounded-lg border border-[#C9D7CD] bg-[#F4F7F4] p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#244C35]">
                  <input type="checkbox" checked={sendInvitation} disabled={isSaving} onChange={e => {
                    setSendInvitation(e.target.checked)
                    if (!invitationEmail) setInvitationEmail(formData.email || "")
                  }} />
                  Enviar convite de acesso ao criar a loja
                </label>
                <p className="mt-2 text-xs leading-5 text-[#4D6254]">O cliente recebe um email e escolhe a própria palavra-passe. Usa este acesso apenas para esta loja.</p>
                {sendInvitation && <div className="mt-3">
                  <label htmlFor="invitation-email" className="mb-1 block text-xs font-semibold text-[#244C35]">Email de acesso do cliente</label>
                  <input id="invitation-email" type="email" required maxLength={254} disabled={isSaving} value={invitationEmail} onChange={e => setInvitationEmail(e.target.value)} placeholder="nome@loja.pt" className="w-full rounded-md border border-[#B8CCBF] bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#246B45] focus:outline-none focus:ring-2 focus:ring-[#246B45]/15" />
                </div>}
              </div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Código Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] uppercase focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="CL001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Designação Curta / Nome Comercial *</label>
                  <input
                    type="text"
                    required
                    value={formData.short_name || ""}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: CACTO ou DETAILER"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="client-portal-slug" className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Endereço da área do cliente</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">/app/</span>
                  <input
                    id="client-portal-slug"
                    type="text"
                    maxLength={70}
                    value={formData.portal_slug || ""}
                    onChange={(e) => setFormData({ ...formData, portal_slug: e.target.value })}
                    placeholder={normalizeStoreSlug(formData.short_name || formData.legal_name || "loja")}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Pode escolher um nome como stef-store. Alterar este campo muda a ligação da loja; nomes iguais recebem um identificador para distinguir as lojas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Designação Social / Razão Fiscal</label>
                  <input
                    type="text"
                    value={formData.legal_name || ""}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: Cacto Moda & Acessórios, Lda"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">NIF / Número Fiscal</label>
                  <input
                    type="text"
                    value={formData.nif || ""}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="514987123"
                  />
                </div>
              </div>

              {/* Foto / Logótipo da Marca ou Loja */}
              <div className="bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)] rounded-xl p-4">
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Foto / Logótipo da Marca ou Loja</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-normal normal-case">(Permite distinguir visualmente o cliente)</span>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-2xs shrink-0 overflow-hidden border-2 relative"
                    style={{ 
                      borderColor: formData.color || "#246B45",
                      backgroundColor: formData.color || "#246B45"
                    }}
                  >
                    {formData.logo_url ? (
                      <img 
                        src={formData.logo_url} 
                        alt="Logo da Marca" 
                        className="w-full h-full object-cover bg-white"
                      />
                    ) : (
                      <span>{formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-8 h-8" />}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-[240px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-bold text-[var(--text-primary)] shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Carregar Foto / Imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {formData.logo_url && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logo_url: "" })}
                          className="px-2.5 py-1.5 bg-[var(--status-critical-soft)] hover:bg-[var(--status-critical-soft)]/80 text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)] rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Remover foto da marca"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover Foto</span>
                        </button>
                      )}
                    </div>

                    {formData.logo_url?.startsWith("data:") ? (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Imagem carregada. Para a substituir, carregue outra imagem ou remova a atual.
                      </p>
                    ) : (
                      <input
                        type="url"
                        value={formData.logo_url || ""}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="Ou cole o URL direto da imagem (ex: https://.../logo.png)"
                        className="w-full border border-[var(--border-subtle)] bg-[var(--surface-bg)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#315D82] focus:outline-none focus:ring-2 focus:ring-[#315D82]/15"
                      />
                    )}

                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Formatos aceites: PNG, JPG, SVG ou WebP. A foto é usada no TMS, nos mapas e no portal deste cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Categoria de Cliente</label>
                  <select
                    value={formData.category || "Cliente Conta Corrente"}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                  >
                    {DEFAULT_CLIENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Cor Identificadora no TMS</label>
                  {initialData?.legacy_service_count !== undefined && <div className="mb-2">
                    <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                      <input type="checkbox" checked={formData.color_mode === 'services'} onChange={e => setFormData({ ...formData,
                        color_mode: e.target.checked ? 'services' : 'manual',
                        color: e.target.checked ? clientActivityColor(initialData.legacy_service_count) : formData.color,
                      })} />
                      Cor automática por nº de serviços ({initialData.legacy_service_count.toLocaleString('pt-PT')})
                    </label>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Histórico da plataforma anterior. Escolher outra cor passa para modo manual.</p>
                  </div>}

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || "#246B45"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value, color_mode: "manual" })}
                      className="w-9 h-9 p-0.5 rounded-md border border-[var(--border-subtle)] cursor-pointer bg-[var(--surface-muted)]"
                    />
                    <select
                      value={formData.color || "#246B45"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value, color_mode: "manual" })}
                      className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    >
                      {formData.color && !CLIENT_COLOR_OPTIONS.some(option => option.value.toLowerCase() === formData.color?.toLowerCase()) && !CLIENT_ACTIVITY_COLORS.some(band => band.color.toLowerCase() === formData.color?.toLowerCase()) && (
                        <option value={formData.color}>Cor personalizada ({formData.color})</option>
                      )}
                      {CLIENT_ACTIVITY_COLORS.map(band => <option key={band.color} value={band.color}>{band.name} · {band.label} serviços</option>)}
                      {CLIENT_COLOR_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]" aria-label="Escala de cores por serviços históricos">
                    {CLIENT_ACTIVITY_COLORS.map(band => <span key={band.min} className="inline-flex items-center gap-1" title={band.name}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />{band.label}
                    </span>)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Observações Internas / Regras Operacionais</label>
                <textarea
                  rows={3}
                  value={formData.observations || ""}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Horários de recolha, exigências de etiquetagem, instruções para motoristas..."
                  className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md p-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MORADAS & FATURAÇÃO */}
          {activeTab === "faturacao" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <MapPin className="w-4 h-4 text-[var(--accent)]" />
                Moradas de Recolha e Faturação
              </h2>

              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)]">Morada principal de recolha</h3>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Usada como remetente nos envios e como local predefinido das recolhas.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Morada / Rua</label>
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Avenida Dom Afonso Henriques, 45"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Código Postal</label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="4800-043"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Localidade / Cidade</label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Guimarães"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">País</label>
                  <select
                    value={formData.country_code || "PT"}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="PT">Portugal (PT)</option>
                    <option value="ES">Espanha (ES)</option>
                    <option value="FR">França (FR)</option>
                    <option value="DE">Alemanha (DE)</option>
                    <option value="UK">Reino Unido (UK)</option>
                  </select>
                </div>
              </div>

              <section className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-4">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">Morada de faturação</h3>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Usada nos dados fiscais e na emissão de faturas. Não altera a morada de recolha.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                  <input type="checkbox" checked={usesPrincipalBillingAddress(formData)}
                    onChange={e => { const same = e.target.checked; setFormData(prev => ({ ...prev, billing_same_as_pickup: same,
                      ...(!same ? { billing_address: prev.billing_address || prev.address || "", billing_postal_code: prev.billing_postal_code || prev.postal_code || "", billing_city: prev.billing_city || prev.city || "", billing_country_code: prev.billing_country_code || prev.country_code || "PT" } : {}),
                    })) }} className="h-4 w-4 accent-[var(--accent)]" />
                  Usar a morada principal para faturação
                </label>
                {usesPrincipalBillingAddress(formData) ? (
                  <p className="text-xs text-[var(--text-secondary)]">{formData.address ? Object.values(getClientBillingAddress(formData)).filter(Boolean).join(", ") : "Preencha a morada principal acima."}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {([
                      ["billing_address", "Morada / Rua de faturação", "Rua e número"],
                      ["billing_postal_code", "Código postal de faturação", "4000-001"],
                      ["billing_city", "Localidade de faturação", "Porto"],
                    ] as const).map(([field, label, placeholder]) => (
                      <div key={field} className={field === "billing_address" ? "md:col-span-2" : ""}>
                        <label htmlFor={field} className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">{label}</label>
                        <input id={field} type="text" value={formData[field] || ""} placeholder={placeholder}
                          onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                          className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </div>
                    ))}
                    <div>
                      <label htmlFor="billing_country_code" className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">País de faturação</label>
                      <CountrySelect id="billing_country_code" value={formData.billing_country_code || ""}
                        onValueChange={value => setFormData(prev => ({ ...prev, billing_country_code: value }))}
                        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Complete a morada de faturação antes de emitir faturas.</p>
                    </div>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Agência de Faturação Linke</label>
                  <select
                    value={formData.billing_agency || "A01 - Sede Guimarães"}
                    onChange={(e) => setFormData({ ...formData, billing_agency: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="A01 - Sede Guimarães">A01 - Sede Guimarães</option>
                    <option value="A02 - Lisboa Oriente">A02 - Lisboa Oriente</option>
                    <option value="A03 - Porto Maia">A03 - Porto Maia</option>
                    <option value="A04 - Coimbra Sul">A04 - Coimbra Sul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Email de Envio de Faturas</label>
                  <input
                    type="email"
                    value={formData.billing_email || ""}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="financeiro@empresa.pt"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTOS */}
          {activeTab === "contactos" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <Phone className="w-4 h-4 text-[var(--accent)]" />
                Pessoas de Contacto & Comunicação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Nome do Responsável / Gestor na Empresa</label>
                  <input
                    type="text"
                    value={formData.manager_name || ""}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: Rui Barbosa"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Email Geral / Operacional</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="encomendas@empresa.pt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Telefone Fixo</label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="253512345"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Telemóvel / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.mobile_phone || ""}
                    onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="912345678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONDIÇÕES & CRÉDITO */}
          {activeTab === "comercial" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <Euro className="w-4 h-4 text-[var(--accent)]" />
                Condições Comerciais & Crédito
              </h2>

              {/* Tipo de Cliente / Modelo de Faturação */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  Modelo de Faturação / Tipo de Cliente
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Conta Corrente */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billing_type: "conta_corrente", category: "Cliente Conta Corrente" })}
                    className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      (formData.billing_type || "conta_corrente") === "conta_corrente"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 shadow-xs ring-1 ring-[var(--accent)]/30"
                        : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        (formData.billing_type || "conta_corrente") === "conta_corrente"
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
                          : "bg-[var(--surface-bg)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${
                          (formData.billing_type || "conta_corrente") === "conta_corrente" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                        }`}>
                          Conta Corrente
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                          Faturação periódica (quinzenal ou mensal) com todos os envios. O cliente paga a prazo com base em extrato.
                        </p>
                      </div>
                      {(formData.billing_type || "conta_corrente") === "conta_corrente" && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 ml-auto" />
                      )}
                    </div>
                  </button>

                  {/* Pay as You Go */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billing_type: "pay_as_you_go", category: "Cliente Pré-Pagamento" })}
                    className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      formData.billing_type === "pay_as_you_go"
                        ? "border-[#315D82] bg-[#F1F5F7] shadow-xs ring-1 ring-[#315D82]/20"
                        : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        formData.billing_type === "pay_as_you_go"
                          ? "bg-[#315D82] text-white border border-[#315D82]"
                          : "bg-[var(--surface-bg)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                      }`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${
                          formData.billing_type === "pay_as_you_go" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                        }`}>
                          Pay as You Go (Wallet)
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                          O cliente carrega saldo antecipadamente via Stripe. Os envios são debitados automaticamente do saldo disponível.
                        </p>
                      </div>
                      {formData.billing_type === "pay_as_you_go" && (
                        <CheckCircle2 className="w-4 h-4 text-[#315D82] shrink-0 ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Frequência de faturação</label>
                  <select
                    value={formData.billing_type === "pay_as_you_go" ? "Pronto Pagamento" : (formData.payment_terms || "A 30 dias")}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    disabled={formData.billing_type === "pay_as_you_go"}
                    className={`w-full border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs font-semibold focus:outline-none transition-all ${
                      formData.billing_type === "pay_as_you_go"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-75"
                        : "bg-[var(--surface-muted)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] cursor-pointer"
                    }`}
                  >
                    <option value="Pronto Pagamento">{formData.billing_type === "pay_as_you_go" ? "Pré-pagamento" : "Diária"}</option>
                    <option value="A 7 dias">A 7 dias (Semanal)</option>
                    <option value="A 15 dias">A 15 dias</option>
                    <option value="A 30 dias">A 30 dias</option>
                    <option value="A 45 dias">A 45 dias</option>
                    <option value="A 60 dias">A 60 dias</option>
                    <option value="A 90 dias">A 90 dias</option>
                  </select>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Intervalo entre faturas automáticas.</p>
                </div>

                <div>
                  <label htmlFor="client-payment-due-days" className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Prazo para pagar (dias)</label>
                  <input id="client-payment-due-days" type="number" min={0} max={365} step={1}
                    value={formData.payment_due_days ?? ""} disabled={formData.billing_type === "pay_as_you_go"}
                    onChange={e => setFormData({ ...formData, payment_due_days: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-full border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs font-semibold bg-[var(--surface-muted)] text-[var(--text-primary)] disabled:opacity-50" />
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Dias após emissão da fatura. 0 = pagamento no próprio dia. Aplica-se às próximas faturas.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Crédito (€)</label>
                    {formData.billing_type !== "pay_as_you_go" && formData.credit_limit_enabled && (
                      <button 
                        type="button" 
                        onClick={() => setIsEditingCredit(!isEditingCredit)}
                        className="text-[10px] text-[var(--accent)] font-semibold hover:underline cursor-pointer"
                      >
                        {isEditingCredit ? "Bloquear edição" : "Editar manualmente"}
                      </button>
                    )}
                  </div>
                  
                  {isEditingCredit && formData.billing_type !== "pay_as_you_go" && formData.credit_limit_enabled ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.credit_limit ?? 5000}
                      onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                      className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                      placeholder="5000"
                    />
                  ) : (
                    <div className={`w-full border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] flex items-center justify-between ${formData.billing_type === "pay_as_you_go" ? "bg-slate-100 text-slate-500 opacity-80 cursor-not-allowed" : "bg-[var(--surface-muted)]"}`}>
                      <span>{formData.billing_type !== "pay_as_you_go" && !formData.credit_limit_enabled ? "Sem limite" : `${Number(formData.credit_limit || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] font-normal font-sans">
                        {formData.billing_type === "pay_as_you_go" ? "Carregamentos Acumulados (Bloqueado)" : formData.credit_limit_enabled ? "Limite Base" : "Conta Corrente"}
                      </span>
                    </div>
                  )}
                  {formData.billing_type !== "pay_as_you_go" && (
                    <div className="mt-2">
                      <button type="button" role="switch" aria-checked={formData.credit_limit_enabled === true}
                        aria-label="Ativar limite de crédito"
                        onClick={() => { setFormData(prev => ({ ...prev, credit_limit_enabled: !prev.credit_limit_enabled })); setIsEditingCredit(false) }}
                        className="inline-flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)] cursor-pointer">
                        <span aria-hidden="true" className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${formData.credit_limit_enabled ? "bg-[#246B45]" : "bg-slate-300"}`}>
                          <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${formData.credit_limit_enabled ? "translate-x-4" : "translate-x-0"}`} />
                        </span>
                        {formData.credit_limit_enabled ? "Limite de crédito ativo" : "Ativar limite de crédito"}
                      </button>
                      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{formData.credit_limit_enabled ? "Novos envios não podem ultrapassar o crédito disponível." : "Sem limite de crédito. O valor definido fica guardado para reativar."} Alteração aplicada ao guardar.</p>
                    </div>
                  )}
                </div>

                {formData.billing_type === "pay_as_you_go" && (
                  <div className="mt-1 p-3 rounded-md bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.2)] col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Gestão de Saldo (Wallet)</span>
                      <span className="text-[9px] bg-white px-1.5 py-0.5 rounded text-[var(--text-secondary)] font-semibold border border-[var(--border-subtle)]">Privilégio Admin</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Saldo Disponível (Projetado)</div>
                        <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
                          {((initialData?.available_credit || 0) + ((formData.credit_limit || 0) - (initialData?.credit_limit || 0))).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = window.prompt("Introduza o valor a carregar (ex: 50.00). Use valores negativos para remover saldo:");
                          if (val && !isNaN(Number(val))) {
                            setFormData(prev => ({ ...prev, credit_limit: (prev.credit_limit || 0) + Number(val) }));
                          }
                        }}
                        className="bg-white hover:bg-slate-50 text-[var(--text-primary)] text-[11px] font-semibold py-1.5 px-3 rounded-md border border-[var(--border-strong)] shadow-2xs flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Injetar Saldo
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Comercial / Gestor de Conta</label>
                  <input
                    type="text"
                    value={formData.assigned_seller || ""}
                    onChange={(e) => setFormData({ ...formData, assigned_seller: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Gestão Comercial Norte"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">IBAN para Débito Direto / Reembolsos</label>
                <input
                  type="text"
                  value={formData.iban || ""}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                  placeholder="PT50 0033 0000 8765 4321 0987 1"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PREÇÁRIO DE ENVIO */}
          {activeTab === "precario" && (
            <div className="space-y-4">
              
              {/* Resumo da configuração de preços */}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Serviços autorizados</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{visibleAssignedTablesCount} de {selectableServicesCount}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Taxas adicionais</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{activeSpecialFeesCount} ativas</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">Combustível</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{formData.pricing?.fuel_surcharge_pct ?? DEFAULT_CLIENT_PRICING.fuel_surcharge_pct}%</p>
                </div>
              </div>

              {/* Navegação por grupos de configuração */}
              <div className="bg-[var(--surface-bg)] p-3 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("servicos_linke")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "servicos_linke"
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Serviços autorizados ({visibleAssignedTablesCount}/{selectableServicesCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("suplementares")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "suplementares"
                        ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Taxas adicionais ({activeSpecialFeesCount} ativas)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("geral")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "geral"
                        ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>Ajustes gerais</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPricing}
                    title="Repõe taxas adicionais, ajustes gerais e escalões personalizados. Mantém os serviços autorizados."
                    className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>Repor preços e taxas</span>
                  </button>
                </div>
              </div>
              <p className="-mt-2 px-1 text-[10px] text-[var(--text-tertiary)]">
                A reposição afeta taxas adicionais, ajustes gerais e escalões personalizados. Os serviços autorizados e os preços definidos por serviço são mantidos.
              </p>

              {/* SUBTAB 1: SERVIÇOS AUTORIZADOS */}
              {precarioSubTab === "servicos_linke" && (
                <div className="space-y-4">
                  {/* Grid de Serviços Linke Autorizados */}
                  <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                          Serviços autorizados para este cliente ({visibleAssignedTablesCount})
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Os serviços abaixo estão autorizados. Abra «Adicionar serviços» para ativar outros.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {Object.keys(formData.custom_tier_overrides || {}).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Deseja repor todas as tabelas e escalões personalizados deste cliente para os valores originais dos Serviços Linke?")) {
                                setFormData((prev) => ({ ...prev, custom_tier_overrides: {} }))
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Repor Todos Escalões Linke
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={assignedServices.length === 0}
                          onClick={() => {
                            if (!confirm(`Remover a autorização de TODOS os ${assignedServices.length} serviços deste cliente, incluindo os ocultos pelo filtro? Após gravar, o cliente não poderá criar envios até voltar a autorizar um serviço. As tabelas e os preços serão mantidos.`)) return
                            setFormData(prev => ({ ...prev, assigned_linke_service_ids: [], default_linke_table_id: "" }))
                            setExpandedPriceServico(null)
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
                        >
                          Remover todas as autorizações
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                        Tipo de tabela
                        <select value={serviceTableFilter} onChange={e => setServiceTableFilter(e.target.value as "all" | "base" | "custom")}
                          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)]">
                          <option value="all">Todas as tabelas</option>
                          <option value="base">Tabelas mãe (primordiais)</option>
                          <option value="custom">Tabelas personalizadas</option>
                        </select>
                      </label>
                      <span className="text-[11px] text-[var(--text-secondary)]">{filteredAssignedServices.length} de {assignedServices.length} autorizadas</span>
                    </div>
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 items-start gap-3">
                      {filteredAssignedServices.map(renderServiceAuthorization)}
                      {assignedServices.length > 0 && filteredAssignedServices.length === 0 && <p className="col-span-full p-4 text-center text-xs text-[var(--text-secondary)]">Não há serviços autorizados deste tipo. Escolha outro filtro.</p>}
                      {assignedServices.length === 0 && selectableServicesCount > 0 && (
                        <p className="col-span-full rounded-lg border border-dashed border-[var(--border-subtle)] p-5 text-center text-xs text-[var(--text-secondary)]">
                          Este cliente ainda não tem serviços autorizados. Abra «Adicionar serviços» para escolher.
                        </p>
                      )}

                      {selectableServicesCount === 0 && (
                        <div className="col-span-2 p-8 text-center text-[var(--text-tertiary)] text-xs">
                          Nenhum serviço Linke configurado. Configure serviços em Configuração &gt; Serviços Linke.
                        </div>
                      )}
                    </div>
                    {unassignedServiceGroups.map(group => (
                      <details key={group.id} className="group border-t border-[var(--border-subtle)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] [&::-webkit-details-marker]:hidden">
                          <span className="flex flex-wrap items-center gap-2"><Plus className="h-3.5 w-3.5" />{group.label} <span className="font-normal text-[var(--text-tertiary)]">({group.services.length} não autorizados)</span></span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                            <p>Selecione um serviço para o autorizar. As alterações são aplicadas ao guardar a ficha.</p>
                            {group.services.length > 0 && <button type="button"
                              aria-label={group.id === "base" ? "Autorizar todas as tabelas primordiais apresentadas" : "Autorizar todas as tabelas personalizadas apresentadas"}
                              onClick={() => setFormData(prev => ({ ...prev, assigned_linke_service_ids: [...new Set([...(prev.assigned_linke_service_ids || []), ...group.services.map(s => s.id)])] }))}
                              className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 font-semibold text-[var(--accent)] hover:bg-[var(--surface-muted)]">
                              Autorizar apresentados
                            </button>}
                          </div>
                          {group.services.length === 0 && <p className="py-3 text-xs text-[var(--text-secondary)]">Não há serviços deste tipo por autorizar.</p>}
                          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">{group.services.map(renderServiceAuthorization)}</div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: SERVIÇOS ESPECIAIS & SUPLEMENTARES (SpecialServices) */}
              {precarioSubTab === "suplementares" && (
                <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Tabela de Taxas Suplementares e Serviços Especiais
                      </h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Valores cobrados ao cliente quando adiciona opções especiais de entrega aos seus envios.
                      </p>
                    </div>
                  </div>

                  {/* Tabs para as diferentes transportadoras */}
                  <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-bg)]">
                    <button
                      type="button"
                      onClick={() => setSpecialProviderTab("ctt")}
                      className={`flex-1 py-3 text-xs font-bold transition-colors ${specialProviderTab === "ctt" ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}
                    >
                      CTT Expresso · {specialFeesList.filter(fee => !fee.special_service_code.startsWith("correos_")).length} taxas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecialProviderTab("correos")}
                      className={`flex-1 py-3 text-xs font-bold transition-colors ${specialProviderTab === "correos" ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}
                    >
                      Correos Express · {specialFeesList.filter(fee => fee.special_service_code.startsWith("correos_")).length} taxas
                    </button>
                  </div>

                  {specialProviderTab === "correos" && (
                    <div className="border-b border-[var(--border-subtle)] bg-emerald-50/40 px-5 py-4">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Correos Express · Incluído no frete</p>
                      <ul className="mt-2 grid gap-1 text-[11px] text-[var(--text-secondary)] sm:grid-cols-2">
                        {CORREOS_INCLUDED_SERVICES.map(item => <li key={item}>✓ {item}</li>)}
                      </ul>
                      <p className="mt-3 text-[11px] text-[var(--text-secondary)]">Valores de referência do contrato apresentado (tarifas de 2025). Os valores já negociados com este cliente são mantidos. Gravar altera apenas este cliente.</p>
                    </div>
                  )}
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {specialFeesList
                      .map((fee, idx) => ({ fee, idx }))
                      .filter(({ fee }) => specialProviderTab === "correos" ? fee.special_service_code.startsWith("correos_") : !fee.special_service_code.startsWith("correos_"))
                      .map(({ fee, idx }) => (
                      <div 
                        key={fee.special_service_code}
                        className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                          fee.is_enabled ? "hover:bg-[var(--surface-muted)]/60" : "bg-[var(--surface-muted)]/30 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3 max-w-lg">
                          <input
                            type="checkbox"
                            checked={fee.is_enabled}
                            disabled={isCorreosConfigurationOnly(fee.special_service_code)}
                            onChange={(e) => handleSpecialFeeChange(idx, "is_enabled", e.target.checked)}
                            className="w-4 h-4 mt-1 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-[var(--text-primary)]">{fee.special_service_name}</span>
                              <span className="text-[10px] font-semibold bg-[var(--surface-muted)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                                {fee.special_service_code.startsWith("correos_") ? "Correos Express" : `CTT · Tipo ${fee.api_type_code}`}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{fee.description}</p>
                            {isCorreosConfigurationOnly(fee.special_service_code) && <p className="mt-1 text-[11px] font-medium text-amber-800">Preço configurável · ativação na emissão pendente; não é cobrado nos envios.</p>}
                          </div>
                        </div>

                        {/* Input controls based on fee type */}
                        <div className="flex items-center gap-3">
                          {fee.fee_type === "percentage" ? (
                            <div className="flex items-center gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Taxa (%)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled && !isCorreosConfigurationOnly(fee.special_service_code)}
                                    value={fee.percentage_value ?? 2.0}
                                    onChange={(e) => handleSpecialFeeChange(idx, "percentage_value", e.target.value)}
                                    className="w-20 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">%</span>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Mínimo (€)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled && !isCorreosConfigurationOnly(fee.special_service_code)}
                                    value={fee.min_value ?? 1.5}
                                    onChange={(e) => handleSpecialFeeChange(idx, "min_value", e.target.value)}
                                    className="w-20 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">€</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Valor Fixo (€)</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={!fee.is_enabled && !isCorreosConfigurationOnly(fee.special_service_code)}
                                  value={fee.fixed_value ?? 0.0}
                                  onChange={(e) => handleSpecialFeeChange(idx, "fixed_value", e.target.value)}
                                  className="w-24 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                />
                                <span className="text-xs font-bold text-[var(--text-secondary)]">€</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBTAB 3: TAXA COMBUSTÍVEL & DESCONTOS GERAIS */}
              {precarioSubTab === "geral" && (
                <div className="bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] space-y-5">
                  <div className="border-b border-[var(--border-subtle)] pb-3">
                    <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[var(--accent)]" />
                      Ajustes Globais da Tabela de Preços
                    </h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">Definições aplicadas sobre o subtotal de todos os serviços de envio.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Nome da Tabela de Preço</label>
                      <input
                        type="text"
                        value={formData.pricing?.table_name || ""}
                        onChange={(e) => handlePricingConfigChange("table_name", e.target.value)}
                        className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        placeholder="Ex: Tabela Especial Têxtil 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Taxa de Combustível Global (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.pricing?.fuel_surcharge_pct ?? 12.5}
                          onChange={(e) => handlePricingConfigChange("fuel_surcharge_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        />
                        <span className="text-xs font-bold text-[var(--text-secondary)]">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Calculada sobre o frete base de cada envio.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Desconto Comercial Especial (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={formData.pricing?.discount_pct ?? 0}
                          onChange={(e) => handlePricingConfigChange("discount_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-[var(--accent)]/40 bg-[var(--accent-soft)]/40 rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        />
                        <span className="text-xs font-bold text-[var(--accent)]">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Desconto bonificado aplicado na fatura.</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: ACESSO À ÁREA DO CLIENTE */}
          {activeTab === "acesso" && (canManageAccess || canSendAccessEmail) && (
            <div className="space-y-6 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Acesso à Área do Cliente</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {canManageAccess ? "Faça a gestão das credenciais de acesso, suspensão de novos envios e bloqueio total ao portal do cliente sem alterar os dados comerciais." : "Envie um link para o email registado na ficha do cliente definir a própria palavra-passe."}
                </p>
              </div>

              {initialData ? (
                <div className="space-y-6">
                  {/* Email de Palavra-Passe */}
                  {onManageAccess && (
                    <div className="flex flex-col gap-3 rounded-xl border border-[#C9D7CD] bg-[#F4F7F4] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#244C35] uppercase tracking-wide">Credenciais e Palavra-passe</h4>
                        <p className="mt-1 text-xs leading-5 text-[#4D6254]">
                          Envie um link para o cliente definir ou alterar a própria palavra-passe. A atual continua válida até ele guardar uma nova.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={onManageAccess}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#246B45] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D5839] disabled:opacity-50 cursor-pointer transition shadow-2xs"
                      >
                        <Mail className="h-4 w-4" />
                        Enviar email de palavra-passe
                      </button>
                    </div>
                  )}

                  {/* Controlos de Bloqueio e Suspensão */}
                  {canManageAccess && <ClientPortalAccessControl key={initialData.id} clientId={initialData.id} disabled={isSaving} />}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 p-5 space-y-4">
                  <div className="rounded-lg border border-[#C9D7CD] bg-[#F4F7F4] p-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#244C35] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendInvitation}
                        disabled={isSaving}
                        onChange={(e) => {
                          setSendInvitation(e.target.checked)
                          if (!invitationEmail) setInvitationEmail(formData.email || "")
                        }}
                      />
                      Enviar convite de acesso ao criar a loja
                    </label>
                    <p className="mt-2 text-xs leading-5 text-[#4D6254]">
                      O cliente recebe um email e escolhe a própria palavra-passe. Usa este acesso apenas para esta loja.
                    </p>
                    {sendInvitation && (
                      <div className="mt-3">
                        <label htmlFor="invitation-email-tab" className="mb-1 block text-xs font-semibold text-[#244C35]">
                          Email de acesso do cliente
                        </label>
                        <input
                          id="invitation-email-tab"
                          type="email"
                          required
                          maxLength={254}
                          disabled={isSaving}
                          value={invitationEmail}
                          onChange={(e) => setInvitationEmail(e.target.value)}
                          placeholder="nome@loja.pt"
                          className="w-full rounded-md border border-[#B8CCBF] bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#246B45] focus:outline-none focus:ring-2 focus:ring-[#246B45]/15"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    As opções de bloqueio total e suspensão de criação de novos envios ficam disponíveis imediatamente após gravar a ficha do cliente.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
        {/* ===================== FOOTER BUTTONS ===================== */}
        <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {saveSuccessMsg && (
              <span className="text-[var(--accent)] font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Gravado com sucesso!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving || saveSuccessMsg}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold px-5 py-2 rounded-lg text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:cursor-default disabled:opacity-75"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A gravar...</span>
                </>
              ) : (
                <>
                  {saveSuccessMsg ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{saveSuccessMsg ? "Gravado" : sendInvitation ? "Gravar e enviar convite" : "Gravar Cliente"}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
