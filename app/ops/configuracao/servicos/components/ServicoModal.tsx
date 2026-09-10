"use client"

import * as React from "react"
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Percent, 
  Package, 
  Layers, 
  Sparkles,
  ShieldCheck,
  UserCheck,
  Tag,
  Clock,
  ArrowDownRight,
  TrendingDown,
  Building2
} from "lucide-react"
import type { ServicoLinke, PriceTierLinke, ZonePriceMatrix } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

interface ServicoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (servico: Partial<ServicoLinke>) => Promise<void>
  initialData?: ServicoLinke | null
  fornecedores: Fornecedor[]
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
}: ServicoModalProps) {
  const [formData, setFormData] = React.useState<Partial<ServicoLinke>>({
    name: "",
    code: "",
    category: "Nacional",
    description: "",
    color: "#059669",
    is_active: true,
    pricing_profile: "Standard / Geral",
    target_client_name: "Clientes Gerais (Volume Base)",
    discount_vs_standard_pct: 0,
    preferred_carrier_id: fornecedores[0]?.id || "",
    preferred_carrier_name: fornecedores[0]?.short_name || "",
    transit_time_label: "24h",
    global_markup_pct: 20.0,
    fuel_surcharge_pct: 12.0,
    cod_fee_pct: 2.5,
    cod_min_fee: 2.50,
    zones: [
      {
        zone_code: "PT-CONT",
        zone_name: "Portugal Continental",
        tiers: DEFAULT_TIERS_TEMPLATE,
      },
    ],
  })

  const [saving, setSaving] = React.useState(false)
  const [discountBatchPct, setDiscountBatchPct] = React.useState<number>(10)

  React.useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({
        name: "",
        code: `LK-${Math.floor(100 + Math.random() * 900)}`,
        category: "Nacional",
        description: "",
        color: "#059669",
        is_active: true,
        pricing_profile: "Standard / Geral",
        target_client_name: "Clientes Gerais (Volume Base)",
        discount_vs_standard_pct: 0,
        preferred_carrier_id: fornecedores[0]?.id || "",
        preferred_carrier_name: fornecedores[0]?.short_name || "CORREOS EXPRESS",
        transit_time_label: "24h",
        global_markup_pct: 20.0,
        fuel_surcharge_pct: 12.0,
        cod_fee_pct: 2.5,
        cod_min_fee: 2.50,
        zones: [
          {
            zone_code: "PT-CONT",
            zone_name: "Portugal Continental",
            tiers: DEFAULT_TIERS_TEMPLATE,
          },
        ],
      })
    }
  }, [initialData, fornecedores, isOpen])

  if (!isOpen) return null

  const handleCarrierChange = (carrierId: string) => {
    const carrier = fornecedores.find((f) => f.id === carrierId)
    setFormData((prev) => ({
      ...prev,
      preferred_carrier_id: carrierId,
      preferred_carrier_name: carrier?.short_name || prev.preferred_carrier_name || "",
    }))
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

  // Apply batch volume discount to all sell prices in all zones
  const applyBatchVolumeDiscount = () => {
    if (discountBatchPct <= 0) return
    setFormData((prev) => {
      const factor = 1 - discountBatchPct / 100
      const updatedZones = (prev.zones || []).map((zone) => ({
        ...zone,
        tiers: zone.tiers.map((t) => {
          const newSell = Number(Math.max(t.cost_price * 1.05, t.sell_price * factor).toFixed(2))
          const newMargin = Number((((newSell - t.cost_price) / t.cost_price) * 100).toFixed(0))
          return {
            ...t,
            sell_price: newSell,
            margin_pct: newMargin,
          }
        }),
      }))

      return {
        ...prev,
        discount_vs_standard_pct: (prev.discount_vs_standard_pct || 0) + discountBatchPct,
        zones: updatedZones,
      }
    })
  }

  // Add a new Zone
  const handleAddZone = () => {
    const zoneName = prompt("Nome da nova Zona (ex: Espanha Peninsular, Açores / Madeira, Europa Zona 1):")
    if (!zoneName) return
    const zoneCode = zoneName.substring(0, 8).toUpperCase().replace(/\s+/g, "-")

    setFormData((prev) => ({
      ...prev,
      zones: [
        ...(prev.zones || []),
        {
          zone_code: zoneCode,
          zone_name: zoneName,
          tiers: [
            { id: `t_${Date.now()}_1`, label: "Até 1 Kg", weight_max: 1, cost_price: 3.50, margin_pct: prev.global_markup_pct || 20, sell_price: 4.20, delivery_time: prev.transit_time_label || "24h", enabled: true },
            { id: `t_${Date.now()}_5`, label: "Até 5 Kg", weight_max: 5, cost_price: 5.00, margin_pct: prev.global_markup_pct || 20, sell_price: 6.00, delivery_time: prev.transit_time_label || "24h", enabled: true },
            { id: `t_${Date.now()}_10`, label: "Até 10 Kg", weight_max: 10, cost_price: 7.50, margin_pct: prev.global_markup_pct || 20, sell_price: 9.00, delivery_time: prev.transit_time_label || "24h", enabled: true },
          ]
        }
      ]
    }))
  }

  // Remove a Zone
  const handleRemoveZone = (zoneIdx: number) => {
    if (confirm("Deseja remover esta zona e todos os seus escalões?")) {
      setFormData((prev) => ({
        ...prev,
        zones: (prev.zones || []).filter((_, idx) => idx !== zoneIdx)
      }))
    }
  }

  // Add a new Tier to a specific Zone
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

  // Remove a Tier from a Zone
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-800">
                  {initialData ? "Editar Serviço & Tabela de Preço Linke" : "Criar Novo Serviço / Tabela Linke"}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  {formData.pricing_profile}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure os custos do transportador e imponha o preço final de venda (PVP) para clientes padrão ou contas VIP.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Customer Profile & Identification */}
          <div className="bg-gradient-to-r from-slate-50 to-emerald-50/30 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>Segmentação de Cliente & Perfil Tarifário</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Perfil de Preço *</label>
                <select
                  value={formData.pricing_profile || "Standard / Geral"}
                  onChange={(e) => setFormData({ ...formData, pricing_profile: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="Standard / Geral">Standard / Geral (Padrão)</option>
                  <option value="VIP / Alto Volume">VIP / Alto Volume (&gt;300 envios/mês)</option>
                  <option value="E-Commerce PME">E-Commerce PME (Lojas Online)</option>
                  <option value="Tabela Negociada Cliente">Tabela Negociada (Cliente Específico)</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Destinatário / Grupo Alvo desta Tabela
                </label>
                <input
                  type="text"
                  value={formData.target_client_name || ""}
                  onChange={(e) => setFormData({ ...formData, target_client_name: e.target.value })}
                  placeholder="Ex: Clientes Gerais, Grupo VIP Grande Volume, ou Nome do Cliente (ex: Nespresso, Zara)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Quick Volume Discount Tool */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-700" />
                <div>
                  <span className="text-xs font-bold text-slate-800">Desconto de Volume em Lote</span>
                  <p className="text-[11px] text-slate-500">Reduzir os preços de venda (PVP) para este perfil de cliente com grande expedição.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={discountBatchPct}
                    onChange={(e) => setDiscountBatchPct(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-center text-emerald-700"
                  />
                  <span className="text-xs font-bold text-slate-600">%</span>
                </div>
                <button
                  type="button"
                  onClick={applyBatchVolumeDiscount}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  Aplicar Desconto aos Preços
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: General Service Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nome do Serviço *</label>
              <input
                type="text"
                required
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Linke Expresso 24H VIP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Código do Serviço *</label>
              <input
                type="text"
                required
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: LK-EXP24-VIP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Categoria</label>
              <select
                value={formData.category || "Nacional"}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Nacional">Nacional</option>
                <option value="Ibérico">Ibérico</option>
                <option value="Ilhas">Ilhas</option>
                <option value="Internacional">Internacional</option>
                <option value="Especial / Recolhas">Especial / Recolhas</option>
                <option value="Ponto / Locky">Ponto / Locky</option>
                <option value="Paletes / Carga">Paletes / Carga</option>
              </select>
            </div>
          </div>

          {/* Section 3: Partner & Operational Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Transportador Parceiro Associado</label>
              <select
                value={formData.preferred_carrier_id || ""}
                onChange={(e) => handleCarrierChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
              >
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.short_name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Prazo de Entrega Estimado</label>
              <input
                type="text"
                value={formData.transit_time_label || "24h"}
                onChange={(e) => setFormData({ ...formData, transit_time_label: e.target.value })}
                placeholder="Ex: 24h, 24/48h, Mesmo Dia"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Markup Global Base (%)</label>
              <input
                type="number"
                step="1"
                value={formData.global_markup_pct ?? 20}
                onChange={(e) => handleGlobalMarkupChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Taxa Combustível (%)</label>
              <input
                type="number"
                step="0.5"
                value={formData.fuel_surcharge_pct ?? 12}
                onChange={(e) => setFormData({ ...formData, fuel_surcharge_pct: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Section 4: Zones and Tiers Table */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Zonas e Escalões de Preço (Custo Fornecedor vs PVP Linke)
                </h3>
                <p className="text-xs text-slate-500">
                  Edite livremente o que o parceiro cobra e imponha o preço final ao cliente por escalão.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddZone}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Nova Zona
              </button>
            </div>

            {(formData.zones || []).map((zone, zoneIdx) => (
              <div key={zone.zone_code || zoneIdx} className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
                {/* Zone Header Bar */}
                <div className="px-4 py-2.5 bg-slate-100 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>{zone.zone_name}</span>
                    <span className="text-slate-400 font-mono">({zone.zone_code})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddTier(zoneIdx)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Escalão de Peso
                    </button>
                    {(formData.zones || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveZone(zoneIdx)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Remover Zona"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Escalão / Rótulo</th>
                        <th className="py-2.5 px-3">Peso Máx (Kg)</th>
                        <th className="py-2.5 px-3 text-right">Custo Parceiro (€)</th>
                        <th className="py-2.5 px-3 text-center">Markup (%)</th>
                        <th className="py-2.5 px-3 text-right font-bold text-emerald-800 bg-emerald-50/50">PVP Linke (€)</th>
                        <th className="py-2.5 px-3 text-right text-slate-600">Lucro (€)</th>
                        <th className="py-2.5 px-3 text-center">Prazo</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {zone.tiers.map((tier, tierIdx) => {
                        const cost = Number(tier.cost_price || 0)
                        const sell = Number(tier.sell_price || 0)
                        const profit = sell - cost

                        return (
                          <tr key={tier.id || tierIdx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              <input
                                type="text"
                                value={tier.label}
                                onChange={(e) => {
                                  const zones = [...(formData.zones || [])]
                                  zones[zoneIdx].tiers[tierIdx].label = e.target.value
                                  setFormData({ ...formData, zones })
                                }}
                                className="w-28 px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 font-semibold"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              <input
                                type="number"
                                step="0.5"
                                value={tier.weight_max}
                                onChange={(e) => {
                                  const zones = [...(formData.zones || [])]
                                  zones[zoneIdx].tiers[tierIdx].weight_max = parseFloat(e.target.value) || 0
                                  setFormData({ ...formData, zones })
                                }}
                                className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 text-center"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={tier.cost_price}
                                onChange={(e) => handleTierCostChange(zoneIdx, tierIdx, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-right bg-white border border-slate-200 rounded font-mono text-xs font-semibold text-slate-800"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                value={tier.margin_pct}
                                onChange={(e) => handleTierMarginChange(zoneIdx, tierIdx, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-center bg-white border border-slate-200 rounded font-mono text-xs font-bold text-emerald-700"
                              />
                            </td>
                            <td className="py-2 px-3 text-right bg-emerald-50/30">
                              <input
                                type="number"
                                step="0.01"
                                value={tier.sell_price}
                                onChange={(e) => handleTierSellPriceChange(zoneIdx, tierIdx, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-right bg-emerald-50 border border-emerald-300 rounded font-mono text-xs font-extrabold text-emerald-800"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                              +{profit.toFixed(2)}€
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500">
                              <input
                                type="text"
                                value={tier.delivery_time}
                                onChange={(e) => {
                                  const zones = [...(formData.zones || [])]
                                  zones[zoneIdx].tiers[tierIdx].delivery_time = e.target.value
                                  setFormData({ ...formData, zones })
                                }}
                                className="w-16 px-1 py-1 text-center bg-white border border-slate-200 rounded text-xs text-slate-600"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              {zone.tiers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTier(zoneIdx, tierIdx)}
                                  className="p-1 text-slate-300 hover:text-red-500 transition-colors"
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
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Segmentação: <strong className="text-slate-700">{formData.pricing_profile}</strong> • {formData.target_client_name}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "A Gravar..." : "Gravar Serviço & Tabela Linke"}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
