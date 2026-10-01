"use client"

import * as React from "react"
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Package, 
  ShieldCheck,
  UserCheck,
  TrendingDown,
  Globe,
  Cpu,
  MapPin,
  Check,
  Lock,
  Percent,
  Layers,
  Settings2,
  Copy,
  CheckCheck,
  AlertCircle,
  Clock,
  Calculator,
  Sliders,
  Zap,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Tag
} from "lucide-react"
import { PortugalFlag, SpainFlag, EuFlag, DestinationBadge } from "./DestinationIcons"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke, PriceTierLinke, ZonePriceMatrix } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

// Available destination zones by carrier (incluindo as 8 zonas oficiais do contrato Linke)
const CARRIER_ZONES: Record<string, { zone_code: string; zone_name: string }[]> = {
  default: [
    { zone_code: "PT-CONT",   zone_name: "Portugal Continental" },
    { zone_code: "PT-ILHAS",  zone_name: "Açores & Madeira (Ilhas PT)" },
    { zone_code: "ES-PENIN",  zone_name: "Espanha Peninsular" },
    { zone_code: "ES-ILHAS",  zone_name: "Espanha — Ilhas (Canárias/Baleares)" },
    { zone_code: "EU 1",      zone_name: "Europa 1 (DE, FR, IT, GB, BE, NL...)" },
    { zone_code: "EU 2",      zone_name: "Europa 2 (PL, CZ, RO, HU, BG...)" },
    { zone_code: "EU 3",      zone_name: "Europa 3 (CH, NO, FI, GR, AD...)" },
    { zone_code: "NA",        zone_name: "América do Norte (EUA / Canadá / México)" },
    { zone_code: "SA",        zone_name: "América do Sul & Central (Brasil, Argentina...)" },
    { zone_code: "O1",        zone_name: "Oriente 1 (Japão, Coreia, Singapura, HK...)" },
    { zone_code: "O2",        zone_name: "Oriente 2 (China, Austrália, EAU, Índia...)" },
    { zone_code: "A",         zone_name: "África & Resto do Mundo (Angola, Cabo Verde...)" },
    { zone_code: "INTL-AERO", zone_name: "Internacional Aéreo (Worldwide)" },
    { zone_code: "INTL-MAR",  zone_name: "Internacional Marítimo / Ilhas" },
    { zone_code: "INTL",      zone_name: "Internacional Geral" },
  ],
  ctt: [
    { zone_code: "PT-CONT",   zone_name: "Portugal Continental" },
    { zone_code: "PT-ILHAS",  zone_name: "Açores & Madeira (Ilhas)" },
    { zone_code: "ES-PENIN",  zone_name: "Espanha Peninsular (CTT 24H ES)" },
    { zone_code: "EU 1",      zone_name: "Europa 1 (CTT Europa Ocidental)" },
    { zone_code: "EU 2",      zone_name: "Europa 2 (CTT Europa do Leste)" },
    { zone_code: "EU 3",      zone_name: "Europa 3 (CTT EFTA / Nórdicos)" },
    { zone_code: "NA",        zone_name: "América do Norte (EUA / CA)" },
    { zone_code: "SA",        zone_name: "América do Sul (Brasil / LATAM)" },
    { zone_code: "O1",        zone_name: "Oriente 1 (Ásia Pacífico Z1)" },
    { zone_code: "O2",        zone_name: "Oriente 2 (China / Médio Oriente)" },
    { zone_code: "A",         zone_name: "África (PALOP e outros)" },
    { zone_code: "INTL-AERO", zone_name: "Internacional Avião Express (CTT)" },
    { zone_code: "INTL",      zone_name: "Internacional Express (CTT)" },
  ],
  correos: [
    { zone_code: "PT-CONT",   zone_name: "Portugal Continental" },
    { zone_code: "PT-ILHAS",  zone_name: "Açores & Madeira (Paq Marítimo)" },
    { zone_code: "ES-PENIN",  zone_name: "Espanha Peninsular (Paq Iberia)" },
    { zone_code: "ES-ILHAS",  zone_name: "Espanha — Ilhas Canárias/Baleares" },
    { zone_code: "EU 1",      zone_name: "Europa 1 Correos Express" },
    { zone_code: "INTL-MAR",  zone_name: "Internacional Marítimo Correos" },
  ],
}

function getCarrierZones(carrierName: string) {
  const key = carrierName.toLowerCase()
  if (key.includes("ctt"))     return CARRIER_ZONES.ctt
  if (key.includes("correos")) return CARRIER_ZONES.correos
  return CARRIER_ZONES.default
}

interface ServicoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (servico: Partial<ServicoLinke>) => Promise<void>
  initialData?: ServicoLinke | null
  fornecedores: Fornecedor[]
  webservices?: any[]
}

const DEFAULT_TIERS_TEMPLATE: PriceTierLinke[] = [
  { id: "t1", label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, margin_pct: 25, sell_price: 3.56, delivery_time: "24h", enabled: true },
  { id: "t2", label: "Até 2 Kg", weight_max: 2, cost_price: 3.15, margin_pct: 25, sell_price: 3.94, delivery_time: "24h", enabled: true },
  { id: "t5", label: "Até 5 Kg", weight_max: 5, cost_price: 3.75, margin_pct: 22, sell_price: 4.58, delivery_time: "24h", enabled: true },
  { id: "t10", label: "Até 10 Kg", weight_max: 10, cost_price: 4.60, margin_pct: 22, sell_price: 5.61, delivery_time: "24h", enabled: true },
  { id: "t20", label: "Até 20 Kg", weight_max: 20, cost_price: 6.20, margin_pct: 20, sell_price: 7.44, delivery_time: "24h", enabled: true },
  { id: "t30", label: "Até 30 Kg", weight_max: 30, cost_price: 7.90, margin_pct: 20, sell_price: 9.48, delivery_time: "24h", enabled: true },
  { id: "t_add", label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, margin_pct: 25, sell_price: 0.35, delivery_time: "24h", enabled: true },
]

export function ServicoModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  fornecedores,
  webservices = [],
}: ServicoModalProps) {
  const [activeTab, setActiveTab] = React.useState<"geral" | "api" | "destinos" | "precos">("geral")
  const [activeZoneIndex, setActiveZoneIndex] = React.useState<number>(0)
  const [saving, setSaving] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState(false)
  const [discountBatchPct, setDiscountBatchPct] = React.useState<number>(10)
  const [zoneMarkupPct, setZoneMarkupPct] = React.useState<number>(20)
  const [showZonePicker, setShowZonePicker] = React.useState(false)
  const [selectedZoneCode, setSelectedZoneCode] = React.useState<string>("")

  const [formData, setFormData] = React.useState<Partial<ServicoLinke>>({
    name: "",
    code: "",
    category: "Nacional",
    description: "",
    color: "#0f172a",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: fornecedores[0]?.id || "",
    preferred_carrier_name: fornecedores[0]?.short_name || "CTT Expresso",
    webservice_connection_id: "ctt_expresso",
    webservice_service_code: "EMSF056.01",
    transit_time_label: "24h",
    global_markup_pct: 20.0,
    fuel_surcharge_pct: 12.0,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    allowed_zones: ["PT-CONT"],
    is_primordial: false,
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: DEFAULT_TIERS_TEMPLATE,
      },
    ],
  })

  React.useEffect(() => {
    if (initialData) {
      let carrierId = initialData.preferred_carrier_id
      let carrierName = initialData.preferred_carrier_name

      const matchedCarrier = fornecedores.find((f) => f.id === carrierId)
      
      const isActuallyCtt = (
        (initialData.name && initialData.name.toLowerCase().includes("ctt")) ||
        (initialData.preferred_carrier_name && initialData.preferred_carrier_name.toLowerCase().includes("ctt")) ||
        (initialData.webservice_service_code && (initialData.webservice_service_code.startsWith("EM") || initialData.webservice_service_code.startsWith("EN")))
      )
      const isActuallyCorreos = (
        (initialData.name && initialData.name.toLowerCase().includes("correos")) ||
        (initialData.preferred_carrier_name && initialData.preferred_carrier_name.toLowerCase().includes("correos")) ||
        (initialData.webservice_service_code && ["93", "63", "62"].includes(initialData.webservice_service_code))
      )

      if (isActuallyCtt && matchedCarrier && matchedCarrier.short_name.toLowerCase().includes("correos")) {
        const cttCarrier = fornecedores.find((f) => f.id === "forn_2" || f.short_name.toLowerCase().includes("ctt"))
        if (cttCarrier) {
          carrierId = cttCarrier.id
          carrierName = cttCarrier.short_name
        }
      } else if (isActuallyCorreos && matchedCarrier && !matchedCarrier.short_name.toLowerCase().includes("correos")) {
        const correosCarrier = fornecedores.find((f) => f.id === "forn_lk003" || f.short_name.toLowerCase().includes("correos"))
        if (correosCarrier) {
          carrierId = correosCarrier.id
          carrierName = correosCarrier.short_name
        }
      } else if (matchedCarrier) {
        carrierName = matchedCarrier.short_name
      }

      const isCorreosCarrier = carrierName?.toLowerCase().includes("correos")
      const defaultWsConn = isCorreosCarrier ? "correos_express" : "ctt_expresso"

      setFormData({
        ...initialData,
        preferred_carrier_id: carrierId,
        preferred_carrier_name: carrierName,
        webservice_connection_id: initialData.webservice_connection_id || defaultWsConn,
      })
      setActiveZoneIndex(0)
    } else {
      const defaultCtt = fornecedores.find(f => f.id === "forn_2" || f.short_name.toLowerCase().includes("ctt")) || fornecedores[0]
      setFormData({
        name: "",
        code: `LK-${Math.floor(100 + Math.random() * 900)}`,
        category: "Nacional",
        description: "",
        color: "#0f172a",
        is_active: true,
        pricing_profile: "Standard / Geral",
        target_client_name: "Clientes Gerais",
        discount_vs_standard_pct: 0,
        preferred_carrier_id: defaultCtt?.id || "",
        preferred_carrier_name: defaultCtt?.short_name || "CTT Expresso",
        webservice_connection_id: "ctt_expresso",
        webservice_service_code: "EMSF056.01",
        transit_time_label: "24h",
        global_markup_pct: 20.0,
        fuel_surcharge_pct: 12.0,
        cod_fee_pct: 2.5,
        cod_min_fee: 2.50,
        allowed_zones: ["PT-CONT"],
        is_primordial: false,
        zones: [
          {
            zone_code: "PT-CONT",
            zone_name: "Portugal Continental",
            tiers: DEFAULT_TIERS_TEMPLATE,
          },
        ],
      })
      setActiveZoneIndex(0)
    }
    setActiveTab("geral")
  }, [initialData, fornecedores, isOpen])

  if (!isOpen) return null

  const handleCarrierChange = (carrierId: string) => {
    const carrier = fornecedores.find((f) => f.id === carrierId)
    const carrierName = carrier?.short_name || ""
    const isCorreos = carrierName.toLowerCase().includes("correos")
    const isCtt = carrierName.toLowerCase().includes("ctt") || carrierName.toLowerCase().includes("correios")

    setFormData((prev) => {
      let nextWsConn = prev.webservice_connection_id
      let nextWsCode = prev.webservice_service_code

      if (isCorreos) {
        nextWsConn = "correos_express"
        if (!nextWsCode || nextWsCode.startsWith("EM") || nextWsCode.startsWith("EN")) {
          nextWsCode = "93"
        }
      } else if (isCtt) {
        nextWsConn = "ctt_expresso"
        if (!nextWsCode || ["93", "63", "62"].includes(nextWsCode)) {
          nextWsCode = "EMSF056.01"
        }
      }

      return {
        ...prev,
        preferred_carrier_id: carrierId,
        preferred_carrier_name: carrierName || prev.preferred_carrier_name || "",
        webservice_connection_id: nextWsConn,
        webservice_service_code: nextWsCode,
      }
    })
  }

  const handleWebserviceChange = (wsConnId: string) => {
    setFormData((prev) => {
      let nextWsCode = prev.webservice_service_code
      if (wsConnId === "correos_express") {
        if (!nextWsCode || nextWsCode.startsWith("EM") || nextWsCode.startsWith("EN")) {
          nextWsCode = "93"
        }
      } else if (wsConnId === "ctt_expresso") {
        if (!nextWsCode || ["93", "63", "62"].includes(nextWsCode)) {
          nextWsCode = "EMSF056.01"
        }
      }
      return {
        ...prev,
        webservice_connection_id: wsConnId,
        webservice_service_code: nextWsCode,
      }
    })
  }

  const handleGlobalMarkupChange = (newMarkup: number) => {
    setFormData((prev) => {
      const updatedZones = (prev.zones || []).map((zone) => ({
        ...zone,
        tiers: zone.tiers.map((t) => ({
          ...t,
          margin_pct: newMarkup,
          sell_price: Number((t.cost_price * (1 + newMarkup / 100)).toFixed(2)),
        })),
      }))

      return {
        ...prev,
        global_markup_pct: newMarkup,
        zones: updatedZones,
      }
    })
  }

  const applyZoneMarkup = () => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      if (!zones[activeZoneIndex]) return prev
      zones[activeZoneIndex] = {
        ...zones[activeZoneIndex],
        tiers: zones[activeZoneIndex].tiers.map((t) => ({
          ...t,
          margin_pct: zoneMarkupPct,
          sell_price: Number((t.cost_price * (1 + zoneMarkupPct / 100)).toFixed(2)),
        })),
      }
      return { ...prev, zones }
    })
  }

  const handleConfirmAddZone = () => {
    const availableZones = getCarrierZones(formData.preferred_carrier_name || "")
    const picked = availableZones.find((z) => z.zone_code === selectedZoneCode)
    if (!picked) return

    const alreadyExists = (formData.zones || []).some((z) => z.zone_code === picked.zone_code)
    if (alreadyExists) {
      setShowZonePicker(false)
      return
    }

    const newZone: ZonePriceMatrix = {
      zone_code: picked.zone_code,
      zone_name: picked.zone_name,
      tiers: [
        { id: `t_${Date.now()}_1`,  label: "Até 1 Kg",   weight_max: 1,   cost_price: 3.50, margin_pct: formData.global_markup_pct || 20, sell_price: Number((3.50 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
        { id: `t_${Date.now()}_2`,  label: "Até 2 Kg",   weight_max: 2,   cost_price: 4.00, margin_pct: formData.global_markup_pct || 20, sell_price: Number((4.00 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
        { id: `t_${Date.now()}_5`,  label: "Até 5 Kg",   weight_max: 5,   cost_price: 5.50, margin_pct: formData.global_markup_pct || 20, sell_price: Number((5.50 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
        { id: `t_${Date.now()}_10`, label: "Até 10 Kg",  weight_max: 10,  cost_price: 7.50, margin_pct: formData.global_markup_pct || 20, sell_price: Number((7.50 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
        { id: `t_${Date.now()}_20`, label: "Até 20 Kg",  weight_max: 20,  cost_price: 10.00, margin_pct: formData.global_markup_pct || 20, sell_price: Number((10.00 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
        { id: `t_${Date.now()}_30`, label: "Até 30 Kg",  weight_max: 30,  cost_price: 13.50, margin_pct: formData.global_markup_pct || 20, sell_price: Number((13.50 * (1 + (formData.global_markup_pct || 20) / 100)).toFixed(2)), delivery_time: formData.transit_time_label || "24h", enabled: true },
      ]
    }

    setFormData((prev) => {
      const nextZones = [...(prev.zones || []), newZone]
      return {
        ...prev,
        zones: nextZones,
      }
    })
    setActiveZoneIndex((formData.zones || []).length)
    setShowZonePicker(false)
    setSelectedZoneCode("")
  }

  const handleRemoveZone = (zoneIdx: number) => {
    if (confirm("Deseja remover esta zona geográfica e os seus escalões?")) {
      setFormData((prev) => ({
        ...prev,
        zones: (prev.zones || []).filter((_, idx) => idx !== zoneIdx)
      }))
      setActiveZoneIndex(0)
    }
  }

  const handleAddTier = (zoneIdx: number) => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      const targetZone = { ...zones[zoneIdx] }
      const lastTier = targetZone.tiers[targetZone.tiers.length - 1]
      const newWeight = lastTier ? (lastTier.weight_max === 999 ? 50 : lastTier.weight_max + 5) : 1
      
      const newTier: PriceTierLinke = {
        id: `t_custom_${Date.now()}`,
        label: `Até ${newWeight} Kg`,
        weight_max: newWeight,
        cost_price: lastTier ? lastTier.cost_price + 1.5 : 3.0,
        margin_pct: prev.global_markup_pct || 20,
        sell_price: lastTier ? Number(((lastTier.cost_price + 1.5) * 1.2).toFixed(2)) : 3.60,
        delivery_time: prev.transit_time_label || "24h",
        enabled: true,
      }

      targetZone.tiers = [...targetZone.tiers, newTier]
      zones[zoneIdx] = targetZone
      return { ...prev, zones }
    })
  }

  const handleRemoveTier = (zoneIdx: number, tierIdx: number) => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      const targetZone = { ...zones[zoneIdx] }
      targetZone.tiers = targetZone.tiers.filter((_, idx) => idx !== tierIdx)
      zones[zoneIdx] = targetZone
      return { ...prev, zones }
    })
  }

  const handleTierCostChange = (zoneIdx: number, tierIdx: number, cost: number) => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      const targetZone = { ...zones[zoneIdx] }
      const tiers = [...targetZone.tiers]
      const tier = { ...tiers[tierIdx] }

      tier.cost_price = cost
      tier.sell_price = Number((cost * (1 + (tier.margin_pct || 20) / 100)).toFixed(2))
      tiers[tierIdx] = tier
      targetZone.tiers = tiers
      zones[zoneIdx] = targetZone

      return { ...prev, zones }
    })
  }

  const handleTierMarginChange = (zoneIdx: number, tierIdx: number, margin: number) => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      const targetZone = { ...zones[zoneIdx] }
      const tiers = [...targetZone.tiers]
      const tier = { ...tiers[tierIdx] }

      tier.margin_pct = margin
      tier.sell_price = Number((tier.cost_price * (1 + margin / 100)).toFixed(2))
      tiers[tierIdx] = tier
      targetZone.tiers = tiers
      zones[zoneIdx] = targetZone

      return { ...prev, zones }
    })
  }

  const handleTierSellPriceChange = (zoneIdx: number, tierIdx: number, sell: number) => {
    setFormData((prev) => {
      const zones = [...(prev.zones || [])]
      const targetZone = { ...zones[zoneIdx] }
      const tiers = [...targetZone.tiers]
      const tier = { ...tiers[tierIdx] }

      tier.sell_price = sell
      if (tier.cost_price > 0) {
        tier.margin_pct = Number((((sell - tier.cost_price) / tier.cost_price) * 100).toFixed(0))
      }
      tiers[tierIdx] = tier
      targetZone.tiers = tiers
      zones[zoneIdx] = targetZone

      return { ...prev, zones }
    })
  }

  const handleCopyCode = () => {
    if (formData.code) {
      navigator.clipboard.writeText(formData.code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1600)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const currentCarrierLogo = getCarrierLogo(formData.preferred_carrier_name)
  const isCttCarrier = formData.preferred_carrier_name?.toLowerCase().includes("ctt")
  const isCorreosCarrier = formData.preferred_carrier_name?.toLowerCase().includes("correos")
  const currentZone = formData.zones?.[activeZoneIndex] || formData.zones?.[0]

  // Calculated Live Metrics for HUD Preview
  const baseStartingPrice = currentZone?.tiers?.[0]?.sell_price || 0
  const avgMargin = currentZone?.tiers?.length
    ? Math.round(currentZone.tiers.reduce((acc, t) => acc + (t.margin_pct || 0), 0) / currentZone.tiers.length)
    : (formData.global_markup_pct || 20)
  const totalTiersCount = (formData.zones || []).reduce((acc, z) => acc + (z.tiers?.length || 0), 0)
  const allowedZonesCount = formData.allowed_zones?.length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/90 ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
        
        {/* TOP BAR / HEADER */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/70 to-white">
          <div className="flex items-start justify-between gap-4">
            
            {/* Left: Carrier Icon & Service Title */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative group shrink-0">
                {currentCarrierLogo ? (
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1.5 transition-transform group-hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentCarrierLogo} alt="Carrier" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                    <Package className="w-5 h-5 text-slate-200" />
                  </div>
                )}
                {formData.is_active && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-2xs" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-base text-slate-900 truncate">
                    {formData.name || (initialData ? "Tabela de Preço" : "Novo Serviço Linke")}
                  </h2>

                  {formData.code && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-colors shadow-2xs group"
                      title="Copiar Código"
                    >
                      <span>{formData.code}</span>
                      {copiedCode ? (
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                      )}
                    </button>
                  )}

                  {formData.is_primordial && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                      <Lock className="w-2.5 h-2.5 text-slate-500" /> Tabela Base
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{formData.preferred_carrier_name}</span>
                  <span>•</span>
                  <span>{formData.pricing_profile}</span>
                  {formData.target_client_name && formData.target_client_name !== "Clientes Gerais" && (
                    <>
                      <span>•</span>
                      <span className="text-slate-700 font-medium truncate max-w-[200px]">{formData.target_client_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Active Toggle & Close */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  formData.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${formData.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {formData.is_active ? "Ativo" : "Inativo"}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* COOL HUD BAR: LIVE SERVICE STATS / GLANCE */}
          <div className="mt-3.5 py-2 px-3 bg-slate-900 text-white rounded-xl shadow-xs flex items-center justify-between gap-3 text-xs overflow-x-auto">
            <div className="flex items-center gap-5 shrink-0">
              
              {/* Base Price */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">PVP Base</span>
                <span className="font-mono font-bold text-white text-sm">
                  {baseStartingPrice > 0 ? `${baseStartingPrice.toFixed(2)} €` : "—"}
                </span>
                <span className="text-[10px] text-slate-400">/{currentZone?.tiers?.[0]?.label || "1kg"}</span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              {/* Margem Média */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Margem</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="w-3 h-3" />
                  {avgMargin}%
                </span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              {/* Transit Time */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-200">{formData.transit_time_label || "24h"}</span>
              </div>

              <div className="h-4 w-px bg-slate-700" />

              {/* Webservice Code */}
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="font-mono text-[11px] text-slate-300">
                  {formData.webservice_service_code || "Sem API"}
                </span>
              </div>
            </div>

            {/* Destination Flags Summary */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400">Cobertura:</span>
              <div className="flex items-center gap-1">
                {(formData.allowed_zones || []).slice(0, 3).map((z) => (
                  <DestinationBadge key={z} code={z} />
                ))}
                {allowedZonesCount > 3 && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                    +{allowedZonesCount - 3}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SLICK SEGMENTED TAB SWITCHER */}
          <div className="flex items-center gap-1 mt-3 pt-1 border-t border-slate-200/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("geral")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "geral"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Geral & Perfil
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("api")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "api"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Webservice & API
              {formData.webservice_service_code && (
                <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                  activeTab === "api" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {formData.webservice_service_code}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("destinos")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "destinos"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Destinos Autorizados
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "destinos" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
              }`}>
                {allowedZonesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("precos")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "precos"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Tabela de Preços
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "precos" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
              }`}>
                {formData.zones?.length || 0} zonas • {totalTiersCount} esc.
              </span>
            </button>
          </div>
        </div>

        {/* MODAL FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          
          {/* TAB 1: GERAL & PERFIL */}
          {activeTab === "geral" && (
            <div className="space-y-6 animate-in fade-in-50 duration-150">
              
              {/* SECTION: IDENTIFICAÇÃO E OPERAÇÃO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Left Card: Core Service Info */}
                <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                    <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      Identificação do Serviço
                    </span>
                    <span className="text-[11px] text-slate-400">Dados base</span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                        <span>Nome Comercial do Serviço *</span>
                        <span className="text-[10px] text-slate-400">Exibido na emissão de guias</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: CTT 24H Encomenda Nacional"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Código do Serviço *</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={formData.code || ""}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="Ex: LK-EXP24"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Prazo de Entrega Estimado</label>
                        <input
                          type="text"
                          value={formData.transit_time_label || "24h"}
                          onChange={(e) => setFormData({ ...formData, transit_time_label: e.target.value })}
                          placeholder="Ex: 24h, 48h, Mesmo Dia"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Category Selector Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-medium text-slate-700">Categoria Logística</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Nacional",
                          "Ibérico",
                          "Ilhas",
                          "Internacional",
                          "Especial / Recolhas",
                          "Ponto / Locky",
                          "Paletes / Carga"
                        ].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFormData({ ...formData, category: cat as any })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              formData.category === cat
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right Card: Carrier & Commercial Profile */}
                <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                    <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      Transportador & Perfil Tarifário
                    </span>
                    <span className="text-[11px] text-slate-400">Regras de negócio</span>
                  </div>

                  <div className="space-y-3">
                    
                    {/* Carrier Selection Cards */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Transportador Parceiro</label>
                      <div className="grid grid-cols-2 gap-2">
                        {fornecedores.map((f) => {
                          const logo = getCarrierLogo(f.short_name)
                          const isSelected = formData.preferred_carrier_id === f.id
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleCarrierChange(f.id)}
                              className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                isSelected
                                  ? "bg-white border-slate-900 ring-1 ring-slate-900 shadow-2xs"
                                  : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0">
                                {logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={logo} alt={f.short_name} className="w-full h-full object-contain" />
                                ) : (
                                  <Package className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{f.short_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono truncate">{f.code || "Carrier"}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Pricing Profile & Target Client */}
                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Perfil Comercial</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { value: "Standard / Geral", label: "Standard / Geral", desc: "Tabela Base Padrão" },
                            { value: "VIP / Alto Volume", label: "VIP / Alto Volume", desc: "Contratos de Volume" },
                            { value: "E-Commerce PME", label: "E-Commerce PME", desc: "Pequenas Lojas" },
                            { value: "Tabela Negociada Cliente", label: "Tabela Negociada", desc: "Cliente Específico" },
                          ].map((profile) => (
                            <button
                              key={profile.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, pricing_profile: profile.value as any })}
                              className={`p-2 rounded-lg border text-left transition-all ${
                                formData.pricing_profile === profile.value
                                  ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <p className="text-xs font-semibold truncate">{profile.label}</p>
                              <p className={`text-[10px] truncate ${formData.pricing_profile === profile.value ? "text-slate-300" : "text-slate-400"}`}>
                                {profile.desc}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">Cliente / Grupo Alvo</label>
                        <input
                          type="text"
                          value={formData.target_client_name || ""}
                          onChange={(e) => setFormData({ ...formData, target_client_name: e.target.value })}
                          placeholder="Ex: Clientes Gerais ou Nome de Empresa Específica"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Bottom Card: Description & Internal Notes */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-2">
                <label className="text-xs font-medium text-slate-700">Descrição / Notas Internas de Operação</label>
                <textarea
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Instruções internas sobre este serviço, condições especiais de recolha ou restrições..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

            </div>
          )}

          {/* TAB 2: WEBSERVICE & API (HIGH TECH OPS CONSOLE) */}
          {activeTab === "api" && (
            <div className="space-y-6 animate-in fade-in-50 duration-150">
              
              {/* API Connection & Subproduct Card */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/90 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Integração Webservice de Emissão Automática
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        O TMS comunica com este endpoint para obter a guia PDF com código de barras oficial e número de envio.
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    API Pronta
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 block">
                      Conexão de WebService Ativa
                    </label>
                    <select
                      value={formData.webservice_connection_id || ""}
                      onChange={(e) => handleWebserviceChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    >
                      <option value="ctt_expresso">CTT Expresso API v2.4 (Ativa)</option>
                      <option value="correos_express">Correos Express REST API (Ativa)</option>
                      <option value="">Emissão Manual / Offline</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 block flex items-center justify-between">
                      <span>Código do Subproduto na API *</span>
                      <span className="text-[10px] text-slate-400 font-mono">Input livre ou escolha preset</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: EMSF056.01 ou 93"
                      value={formData.webservice_service_code || ""}
                      onChange={(e) => setFormData({ ...formData, webservice_service_code: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Subproduct Quick Click Cards with Visual Distinction */}
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Presets Oficiais do Transportador ({formData.preferred_carrier_name}):
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {isCorreosCarrier ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "93" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "93"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">93</span>
                            {formData.webservice_service_code === "93" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">Paq 24 (Ibérico)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "93" ? "text-slate-300" : "text-slate-500"}`}>
                            Entrega em 24h na Península Ibérica
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "63" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "63"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">63</span>
                            {formData.webservice_service_code === "63" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">E-Paq 24 (E-Commerce)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "63" ? "text-slate-300" : "text-slate-500"}`}>
                            Notificações SMS/Email e devolução facilitada
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "62" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "62"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">62</span>
                            {formData.webservice_service_code === "62" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">Paq 48 / Islas</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "62" ? "text-slate-300" : "text-slate-500"}`}>
                            Ilhas Baleares e Canárias Espanha
                          </p>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "EMSF056.01" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "EMSF056.01"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">EMSF056.01</span>
                            {formData.webservice_service_code === "EMSF056.01" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">24H Encomenda (Guia DD)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "EMSF056.01" ? "text-slate-300" : "text-slate-500"}`}>
                            Entrega dia seguinte em Portugal Continental
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "EMSF057.01" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "EMSF057.01"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">EMSF057.01</span>
                            {formData.webservice_service_code === "EMSF057.01" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">48H Encomenda (Guia DB)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "EMSF057.01" ? "text-slate-300" : "text-slate-500"}`}>
                            Entrega em 48 horas custo económico
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "ENCF008.01" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "ENCF008.01"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">ENCF008.01</span>
                            {formData.webservice_service_code === "ENCF008.01" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">Económico 48 (Guia EQ)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "ENCF008.01" ? "text-slate-300" : "text-slate-500"}`}>
                            Carga e volumes pesados com tarifa reduzida
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, webservice_service_code: "EMSF010.01" })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.webservice_service_code === "EMSF010.01"
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs">EMSF010.01</span>
                            {formData.webservice_service_code === "EMSF010.01" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs font-semibold mt-1">19 Múltiplo (Guia EG)</p>
                          <p className={`text-[10px] ${formData.webservice_service_code === "EMSF010.01" ? "text-slate-300" : "text-slate-500"}`}>
                            Envios multi-volumes até 19 volumes
                          </p>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* COOL LABEL HEADER VISUALIZER */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Visualização da Etiqueta Emitida pela API
                    </span>
                    <span className="font-mono text-[10px]">SUBPROD: {formData.webservice_service_code || "---"}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white p-1 flex items-center justify-center shrink-0">
                        {currentCarrierLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={currentCarrierLogo} alt="Carrier" className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-800" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white tracking-wide">{formData.name || "Serviço Linke"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {formData.preferred_carrier_name} • {formData.transit_time_label || "24H"}
                        </p>
                      </div>
                    </div>

                    {/* Simulated Barcode Lines */}
                    <div className="flex items-center gap-0.5 h-6 opacity-75">
                      {[2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2].map((w, i) => (
                        <div key={i} className="bg-white h-full" style={{ width: `${w * 1.5}px` }} />
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* OPERATIONAL SURCHARGES & FEES */}
              <div className="p-5 rounded-xl border border-slate-200/80 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-slate-500" />
                    Taxas Operacionais & Suplementos
                  </span>
                  <span className="text-[11px] text-slate-500">Calculados automaticamente por envio</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Margem Base Global</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="1"
                        value={formData.global_markup_pct ?? 20}
                        onChange={(e) => handleGlobalMarkupChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-mono font-bold text-slate-900"
                      />
                      <span className="font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Taxa Combustível</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        value={formData.fuel_surcharge_pct ?? 12}
                        onChange={(e) => setFormData({ ...formData, fuel_surcharge_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-mono font-bold text-slate-900"
                      />
                      <span className="font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Taxa Reembolso</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        value={formData.cod_fee_pct ?? 2.5}
                        onChange={(e) => setFormData({ ...formData, cod_fee_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-mono font-bold text-slate-900"
                      />
                      <span className="font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <label className="text-[11px] font-medium text-slate-600 block">Mín. Reembolso</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.cod_min_fee ?? 2.50}
                        onChange={(e) => setFormData({ ...formData, cod_min_fee: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-mono font-bold text-slate-900"
                      />
                      <span className="font-bold text-slate-400">€</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: DESTINOS AUTORIZADOS (REGIONAL LOGISTICS MATRIX) */}
          {activeTab === "destinos" && (
            <div className="space-y-5 animate-in fade-in-50 duration-150">
              
              {/* Header & Quick Action Presets */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Matriz de Cobertura Geográfica
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O TMS bloqueará a emissão de envios se o destino não constar nesta lista autorizada.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    {allowedZonesCount} Zonas Selecionadas
                  </span>
                </div>
              </div>

              {/* Fast Presets Filter Bar */}
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Atalhos Rápidos:</span>
                
                {[
                  { label: "Só Continental", zones: ["PT-CONT"] },
                  { label: "Portugal + Ilhas", zones: ["PT-CONT", "PT-ILHAS"] },
                  { label: "Península Ibérica", zones: ["PT-CONT", "ES-PENIN"] },
                  { label: "Ibérico Total (c/ Ilhas)", zones: ["PT-CONT", "PT-ILHAS", "ES-PENIN", "ES-ILHAS"] },
                  { label: "Toda a Europa", zones: ["PT-CONT", "PT-ILHAS", "ES-PENIN", "ES-ILHAS", "EU 1", "EU 2", "EU 3", "EU-Z1", "EU-Z2", "EU-Z3"] },
                  { label: "Américas (NA+SA)", zones: ["PT-CONT", "NA", "SA"] },
                  { label: "Oriente (O1+O2)", zones: ["PT-CONT", "O1", "O2"] },
                  { label: "África (A)", zones: ["PT-CONT", "A"] },
                  { label: "Mundial 100%", zones: ["PT-CONT", "PT-ILHAS", "ES-PENIN", "ES-ILHAS", "EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A", "INTL-AERO", "INTL-MAR", "INTL"] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, allowed_zones: preset.zones }))}
                    className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, allowed_zones: [] }))}
                  className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
                >
                  Limpar Todos
                </button>
              </div>

              {/* GROUPED DESTINATION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Group 1: Território Nacional */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-xs font-semibold text-slate-800">
                    <PortugalFlag className="w-4 h-3" />
                    <span>Portugal (Nacional)</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { code: "PT-CONT",  name: "Portugal Continental", desc: "Entrega em 24h/48h terrestre" },
                      { code: "PT-ILHAS", name: "Açores & Madeira (Ilhas)", desc: "Aéreo Express & Marítimo Ilhas" },
                    ].map((dest) => {
                      const isAllowed = (formData.allowed_zones || []).includes(dest.code)
                      const toggle = () => {
                        const current = formData.allowed_zones || []
                        setFormData((prev) => ({
                          ...prev,
                          allowed_zones: isAllowed ? current.filter(z => z !== dest.code) : [...current, dest.code]
                        }))
                      }

                      return (
                        <button
                          key={dest.code}
                          type="button"
                          onClick={toggle}
                          className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                            isAllowed
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isAllowed ? "bg-white text-slate-900 border-white" : "border-slate-300 bg-white"
                            }`}>
                              {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <div>
                              <p className="text-xs font-semibold">{dest.name}</p>
                              <p className={`text-[10px] ${isAllowed ? "text-slate-300" : "text-slate-400"}`}>{dest.desc}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isAllowed ? "bg-slate-800 text-slate-200" : "bg-white border border-slate-200 text-slate-500"
                          }`}>
                            {dest.code}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Group 2: Espanha */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-xs font-semibold text-slate-800">
                    <SpainFlag className="w-4 h-3" />
                    <span>Espanha & Ilhas</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { code: "ES-PENIN", name: "Espanha Peninsular", desc: "Rede terrestre Ibérica 24h/48h" },
                      { code: "ES-ILHAS", name: "Canárias, Baleares & Enclaves", desc: "Baleares marítimo & Canárias aéreo" },
                    ].map((dest) => {
                      const isAllowed = (formData.allowed_zones || []).includes(dest.code)
                      const toggle = () => {
                        const current = formData.allowed_zones || []
                        setFormData((prev) => ({
                          ...prev,
                          allowed_zones: isAllowed ? current.filter(z => z !== dest.code) : [...current, dest.code]
                        }))
                      }

                      return (
                        <button
                          key={dest.code}
                          type="button"
                          onClick={toggle}
                          className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                            isAllowed
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isAllowed ? "bg-white text-slate-900 border-white" : "border-slate-300 bg-white"
                            }`}>
                              {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <div>
                              <p className="text-xs font-semibold">{dest.name}</p>
                              <p className={`text-[10px] ${isAllowed ? "text-slate-300" : "text-slate-400"}`}>{dest.desc}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isAllowed ? "bg-slate-800 text-slate-200" : "bg-white border border-slate-200 text-slate-500"
                          }`}>
                            {dest.code}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Group 3: União Europeia (Tabela Oficial Linke) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-xs font-semibold text-slate-800">
                    <EuFlag className="w-4 h-3" />
                    <span>Europa (3 Zonas Contratuais)</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { code: "EU 1", name: "Europa 1 (Ocidental & Central)", desc: "Alemanha, França, Reino Unido, Itália, Holanda, Bélgica, Espanha..." },
                      { code: "EU 2", name: "Europa 2 (Leste & Bálcãs)", desc: "Polónia, Rep. Checa, Roménia, Bulgária, Hungria, Croácia, Ucrânia..." },
                      { code: "EU 3", name: "Europa 3 (EFTA & Mediterrâneo)", desc: "Suíça, Noruega, Finlândia, Grécia, Andorra, Liechtenstein..." },
                    ].map((dest) => {
                      const isAllowed = (formData.allowed_zones || []).includes(dest.code) || (dest.code === "EU 1" && (formData.allowed_zones || []).includes("EU-Z1"))
                      const toggle = () => {
                        const current = formData.allowed_zones || []
                        setFormData((prev) => ({
                          ...prev,
                          allowed_zones: isAllowed ? current.filter(z => z !== dest.code && z !== `EU-Z${dest.code.split(" ")[1]}`) : [...current, dest.code]
                        }))
                      }

                      return (
                        <button
                          key={dest.code}
                          type="button"
                          onClick={toggle}
                          className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                            isAllowed
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isAllowed ? "bg-white text-slate-900 border-white" : "border-slate-300 bg-white"
                            }`}>
                              {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <div>
                              <p className="text-xs font-semibold">{dest.name}</p>
                              <p className={`text-[10px] ${isAllowed ? "text-slate-300" : "text-slate-400"}`}>{dest.desc}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isAllowed ? "bg-slate-800 text-slate-200" : "bg-white border border-slate-200 text-slate-500"
                          }`}>
                            {dest.code}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Group 4: Internacional & Continentes (Oficial Linke Exportação Aéreo) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-xs font-semibold text-slate-800">
                    <Globe className="w-4 h-4 text-slate-600" />
                    <span>Mundo (5 Zonas Contratuais)</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { code: "NA", name: "América do Norte (NA)", desc: "Canadá, Estados Unidos, México, Porto Rico" },
                      { code: "SA", name: "América do Sul & Central (SA)", desc: "Brasil, Argentina, Chile, Colômbia, Peru, Panamá..." },
                      { code: "O1", name: "Oriente 1 (O1)", desc: "Japão, Coreia do Sul, Hong Kong, Singapura, Tailândia, Egito..." },
                      { code: "O2", name: "Oriente 2 (O2)", desc: "China, Austrália, Emiratos Árabes Unidos, Índia, Israel, Qatar..." },
                      { code: "A",  name: "África & Resto do Mundo (A)", desc: "Angola, Cabo Verde, Moçambique, África do Sul, Marrocos, Nigéria..." },
                    ].map((dest) => {
                      const isAllowed = (formData.allowed_zones || []).includes(dest.code)
                      const toggle = () => {
                        const current = formData.allowed_zones || []
                        setFormData((prev) => ({
                          ...prev,
                          allowed_zones: isAllowed ? current.filter(z => z !== dest.code) : [...current, dest.code]
                        }))
                      }

                      return (
                        <button
                          key={dest.code}
                          type="button"
                          onClick={toggle}
                          className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                            isAllowed
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isAllowed ? "bg-white text-slate-900 border-white" : "border-slate-300 bg-white"
                            }`}>
                              {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <div>
                              <p className="text-xs font-semibold">{dest.name}</p>
                              <p className={`text-[10px] ${isAllowed ? "text-slate-300" : "text-slate-400"}`}>{dest.desc}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isAllowed ? "bg-slate-800 text-slate-200" : "bg-white border border-slate-200 text-slate-500"
                          }`}>
                            {dest.code}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: TABELA DE PREÇOS (THE MODERN PRICING DESK) */}
          {activeTab === "precos" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              
              {/* ZONE NAVIGATION BAR */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(formData.zones || []).map((zone, idx) => (
                    <button
                      key={zone.zone_code || idx}
                      type="button"
                      onClick={() => setActiveZoneIndex(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeZoneIndex === idx
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                    >
                      <DestinationBadge code={zone.zone_code} />
                      <span>{zone.zone_name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        activeZoneIndex === idx ? "bg-slate-800 text-slate-200" : "bg-white text-slate-500"
                      }`}>
                        {zone.tiers?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>

                {!showZonePicker ? (
                  <button
                    type="button"
                    onClick={() => {
                      const available = getCarrierZones(formData.preferred_carrier_name || "")
                      const existing = new Set((formData.zones || []).map((z) => z.zone_code))
                      const first = available.find((z) => !existing.has(z.zone_code))
                      setSelectedZoneCode(first?.zone_code || available[0]?.zone_code || "")
                      setShowZonePicker(true)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-medium transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    Adicionar Zona
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-xs">
                    <select
                      value={selectedZoneCode}
                      onChange={(e) => setSelectedZoneCode(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                    >
                      {getCarrierZones(formData.preferred_carrier_name || "").map((z) => {
                        const alreadyAdded = (formData.zones || []).some((existing) => existing.zone_code === z.zone_code)
                        return (
                          <option key={z.zone_code} value={z.zone_code} disabled={alreadyAdded}>
                            {z.zone_name}{alreadyAdded ? " (já adicionada)" : ""}
                          </option>
                        )
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={handleConfirmAddZone}
                      className="px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-2xs"
                    >
                      Adicionar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowZonePicker(false)}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* ACTIVE ZONE TOOLBAR */}
              {currentZone && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center gap-2">
                      <DestinationBadge code={currentZone.zone_code} />
                      <span className="font-bold text-slate-900 text-xs">{currentZone.zone_name}</span>
                      <span className="font-mono text-[11px] text-slate-400">({currentZone.zone_code})</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Zone Markup Quick Adjuster */}
                      <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[11px] font-medium text-slate-500">Markup Zona:</span>
                        <input
                          type="number"
                          value={zoneMarkupPct}
                          onChange={(e) => setZoneMarkupPct(parseFloat(e.target.value) || 0)}
                          className="w-12 px-1 text-center font-mono text-xs font-bold text-slate-800 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400">%</span>
                        <button
                          type="button"
                          onClick={applyZoneMarkup}
                          className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition-colors ml-1 shadow-2xs"
                        >
                          Aplicar
                        </button>
                      </div>

                      {/* Add Tier Button */}
                      <button
                        type="button"
                        onClick={() => handleAddTier(activeZoneIndex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                        Novo Escalão
                      </button>

                      {(formData.zones || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(activeZoneIndex)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remover Zona Geográfica"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SPREADSHEET TABLE */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Escalão / Rótulo</th>
                          <th className="py-2.5 px-2 text-center">Peso Máx (Kg)</th>
                          <th className="py-2.5 px-3 text-right">Custo Parceiro (€)</th>
                          <th className="py-2.5 px-2 text-center">Margem (%)</th>
                          <th className="py-2.5 px-3 text-right font-bold text-slate-900">PVP Linke (€)</th>
                          <th className="py-2.5 px-3 text-right text-emerald-700">Lucro (€)</th>
                          <th className="py-2.5 px-2 text-center">Prazo</th>
                          <th className="py-2.5 px-2 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentZone.tiers.map((tier, tierIdx) => {
                          const cost = Number(tier.cost_price || 0)
                          const sell = Number(tier.sell_price || 0)
                          const profit = sell - cost
                          const margin = Number(tier.margin_pct || 0)

                          // Margin health badge color
                          const marginColor = margin >= 22 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : margin >= 15
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"

                          return (
                            <tr key={tier.id || tierIdx} className="hover:bg-slate-50/70 transition-colors group">
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={tier.label}
                                  onChange={(e) => {
                                    const zones = [...(formData.zones || [])]
                                    zones[activeZoneIndex].tiers[tierIdx].label = e.target.value
                                    setFormData({ ...formData, zones })
                                  }}
                                  className="w-32 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-900 font-medium focus:ring-1 focus:ring-slate-900"
                                />
                              </td>
                              
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={tier.weight_max}
                                  onChange={(e) => {
                                    const zones = [...(formData.zones || [])]
                                    zones[activeZoneIndex].tiers[tierIdx].weight_max = parseFloat(e.target.value) || 0
                                    setFormData({ ...formData, zones })
                                  }}
                                  className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono font-medium text-center focus:ring-1 focus:ring-slate-900"
                                />
                              </td>

                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tier.cost_price}
                                  onChange={(e) => handleTierCostChange(activeZoneIndex, tierIdx, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-right bg-white border border-slate-200 rounded-md font-mono text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900"
                                />
                              </td>

                              <td className="py-1.5 px-2 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="1"
                                    value={tier.margin_pct}
                                    onChange={(e) => handleTierMarginChange(activeZoneIndex, tierIdx, parseFloat(e.target.value) || 0)}
                                    className={`w-14 px-1.5 py-1 text-center border rounded-md font-mono text-xs font-bold ${marginColor}`}
                                  />
                                </div>
                              </td>

                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tier.sell_price}
                                  onChange={(e) => handleTierSellPriceChange(activeZoneIndex, tierIdx, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-right bg-white border border-slate-300 rounded-md font-mono text-xs font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 shadow-2xs"
                                />
                              </td>

                              <td className="py-1.5 px-3 text-right font-mono text-xs font-bold text-emerald-700">
                                +{profit.toFixed(2)}€
                              </td>

                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="text"
                                  value={tier.delivery_time}
                                  onChange={(e) => {
                                    const zones = [...(formData.zones || [])]
                                    zones[activeZoneIndex].tiers[tierIdx].delivery_time = e.target.value
                                    setFormData({ ...formData, zones })
                                  }}
                                  className="w-16 px-1.5 py-1 text-center bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:ring-1 focus:ring-slate-900"
                                />
                              </td>

                              <td className="py-1.5 px-2 text-center">
                                {currentZone.tiers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTier(activeZoneIndex, tierIdx)}
                                    className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remover Escalão"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ZONE FINANCIAL INTELLIGENCE FOOTER */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Preço de Entrada</span>
                      <span className="font-mono font-bold text-slate-900">
                        {currentZone.tiers[0]?.sell_price ? `${Number(currentZone.tiers[0].sell_price).toFixed(2)} €` : "—"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Margem Média da Zona</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {currentZone.tiers.length
                          ? `${Math.round(currentZone.tiers.reduce((a, t) => a + (t.margin_pct || 0), 0) / currentZone.tiers.length)}%`
                          : "—"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Lucro Médio por Envio</span>
                      <span className="font-mono font-bold text-slate-900">
                        +{currentZone.tiers.length
                          ? (currentZone.tiers.reduce((a, t) => a + (t.sell_price - t.cost_price), 0) / currentZone.tiers.length).toFixed(2)
                          : "0.00"} €
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Escalões Nesta Zona</span>
                      <span className="font-mono font-bold text-slate-700">
                        {currentZone.tiers.length} escalões ativos
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* MODAL FOOTER */}
          <div className="pt-4 mt-6 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-500 truncate">
              <span className="font-semibold text-slate-800">{formData.name || "Serviço"}</span>
              {formData.code && <span className="font-mono text-slate-400">({formData.code})</span>}
              <span>•</span>
              <span className="text-slate-600">{formData.preferred_carrier_name}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>A Gravar...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Gravar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
