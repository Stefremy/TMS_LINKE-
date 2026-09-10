"use client"

import * as React from "react"
import { 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Truck, 
  Clock, 
  Euro, 
  Percent, 
  HelpCircle,
  TrendingUp,
  Package,
  ShieldCheck,
  UserCheck,
  TrendingDown
} from "lucide-react"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke, CotacaoSimulacaoResult } from "../types"

interface SimuladorCotacaoTabProps {
  servicos: ServicoLinke[]
}

export function SimuladorCotacaoTab({ servicos }: SimuladorCotacaoTabProps) {
  const [weightKg, setWeightKg] = React.useState<number>(1.5)
  const [lengthCm, setLengthCm] = React.useState<number>(20)
  const [widthCm, setWidthCm] = React.useState<number>(15)
  const [heightCm, setHeightCm] = React.useState<number>(10)
  const [selectedDestinationZone, setSelectedDestinationZone] = React.useState<string>("PT-CONT")
  const [selectedClientProfile, setSelectedClientProfile] = React.useState<string>("Todos")
  const [isCod, setIsCod] = React.useState<boolean>(false)
  const [codValue, setCodValue] = React.useState<number>(50.00)

  // Volumetric weight (standard 167 coefficient: L*W*H / 6000 or m3 * 167)
  const volumeM3 = (lengthCm * widthCm * heightCm) / 1000000
  const volumetricWeightKg = Number((volumeM3 * 167).toFixed(2))
  const chargeableWeight = Math.max(weightKg, volumetricWeightKg)

  // Zones available
  const availableZones = [
    { code: "PT-CONT", name: "Portugal Continental" },
    { code: "ES-PENIN", name: "Espanha Peninsular" },
    { code: "PT-ILHAS", name: "Açores & Madeira (Ilhas)" },
    { code: "PT-PICKUP", name: "Pontos CTT & Cacifos Locky" },
    { code: "EU-ZONA1", name: "Europa Zona 1 (FR, DE, BE, NL)" },
  ]

  const clientProfiles = ["Todos", "Standard / Geral", "VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"]

  // Calculate quotes for all matching services
  const quotes: CotacaoSimulacaoResult[] = React.useMemo(() => {
    const results: CotacaoSimulacaoResult[] = []

    servicos
      .filter((s) => s.is_active)
      .filter((s) => selectedClientProfile === "Todos" || s.pricing_profile === selectedClientProfile)
      .forEach((servico) => {
        // Find matching zone in service
        const zone = servico.zones.find(
          (z) => z.zone_code === selectedDestinationZone || z.zone_name.toLowerCase().includes(selectedDestinationZone.toLowerCase())
        )

        if (!zone) return

        // Sort tiers by weight_max ascending
        const sortedTiers = [...zone.tiers].sort((a, b) => a.weight_max - b.weight_max)
        
        let matchedTier = sortedTiers.find((t) => t.weight_max >= chargeableWeight)
        let costPrice = 0
        let sellPrice = 0

        if (matchedTier) {
          costPrice = matchedTier.cost_price
          sellPrice = matchedTier.sell_price
        } else if (sortedTiers.length > 0) {
          const maxBaseTier = sortedTiers[sortedTiers.length - 2] || sortedTiers[sortedTiers.length - 1]
          const addTier = sortedTiers[sortedTiers.length - 1]
          const extraKgs = Math.ceil(chargeableWeight - maxBaseTier.weight_max)
          
          costPrice = maxBaseTier.cost_price + (extraKgs * addTier.cost_price)
          sellPrice = maxBaseTier.sell_price + (extraKgs * addTier.sell_price)
          matchedTier = maxBaseTier
        }

        if (matchedTier) {
          const fuelPct = servico.fuel_surcharge_pct || 0
          const fuelAmount = Number((sellPrice * (fuelPct / 100)).toFixed(2))
          
          let codAmount = 0
          if (isCod) {
            const codPctFee = (codValue * (servico.cod_fee_pct || 2.5)) / 100
            codAmount = Math.max(codPctFee, servico.cod_min_fee || 2.50)
          }

          const finalSellPrice = Number((sellPrice + fuelAmount + codAmount).toFixed(2))
          const marginAmount = Number((sellPrice - costPrice).toFixed(2))
          const marginPct = costPrice > 0 ? Number(((marginAmount / costPrice) * 100).toFixed(0)) : 0

          results.push({
            servicoId: servico.id,
            servicoName: servico.name,
            pricingProfile: servico.pricing_profile,
            targetClient: servico.target_client_name || "Clientes Gerais",
            carrierName: servico.preferred_carrier_name,
            carrierColor: servico.color || "#059669",
            zoneName: zone.zone_name,
            weight: chargeableWeight,
            transitTime: matchedTier.delivery_time || servico.transit_time_label,
            costPrice,
            sellPrice,
            marginAmount,
            marginPct,
            fuelAmount,
            finalSellPrice,
          })
        }
      })

    return results.sort((a, b) => a.finalSellPrice - b.finalSellPrice)
  }, [servicos, selectedDestinationZone, selectedClientProfile, chargeableWeight, isCod, codValue])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Simulation Inputs */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Calculator className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-800">
              Parâmetros da Cotação & Simulação
            </h3>
          </div>

          {/* Profile Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">
              Comparar Perfil de Cliente
            </label>
            <select
              value={selectedClientProfile}
              onChange={(e) => setSelectedClientProfile(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {clientProfiles.map((p) => (
                <option key={p} value={p}>
                  {p === "Todos" ? "Todos os Perfis (Comparativo Geral)" : p}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Zone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">
              Zona de Destino
            </label>
            <select
              value={selectedDestinationZone}
              onChange={(e) => setSelectedDestinationZone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {availableZones.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name} ({z.code})
                </option>
              ))}
            </select>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex justify-between">
              <span>Peso Real</span>
              <span className="text-emerald-700 font-mono font-bold">{weightKg} Kg</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="1000"
              value={weightKg}
              onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0.1)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">
              Dimensões (Comprimento x Largura x Altura cm)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="C (cm)"
                value={lengthCm}
                onChange={(e) => setLengthCm(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
              <input
                type="number"
                placeholder="L (cm)"
                value={widthCm}
                onChange={(e) => setWidthCm(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
              <input
                type="number"
                placeholder="A (cm)"
                value={heightCm}
                onChange={(e) => setHeightCm(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Volumetric Weight Calculation Result */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span>Volume m³:</span>
              <span className="font-mono font-semibold">{volumeM3.toFixed(4)} m³</span>
            </div>
            <div className="flex justify-between">
              <span>Peso Volumétrico (1:167):</span>
              <span className="font-mono font-semibold">{volumetricWeightKg} Kg</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Peso Taxável:</span>
              <span className="font-mono text-emerald-800">{chargeableWeight} Kg</span>
            </div>
          </div>

          {/* COD (Cobrança) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCod}
                onChange={(e) => setIsCod(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-xs font-semibold text-slate-700">Com Cobrança no Destino (COD)</span>
            </label>

            {isCod && (
              <div className="space-y-1 pl-6">
                <label className="text-[11px] text-slate-500 block">Valor a Cobrar (€)</label>
                <input
                  type="number"
                  step="1"
                  value={codValue}
                  onChange={(e) => setCodValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulation Results */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Cotações Comparadas: Cliente Standard vs Contas VIP
            </h3>
            <p className="text-xs text-slate-500">
              Veja o preço de venda para clientes comuns vs clientes com desconto por volume de envios.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
            {quotes.length} tabelas disponíveis
          </span>
        </div>

        <div className="space-y-3">
          {quotes.map((q) => {
            const isVip = q.pricingProfile === "VIP / Alto Volume" || q.pricingProfile === "Tabela Negociada Cliente"

            return (
              <div
                key={`${q.servicoId}-${q.pricingProfile}`}
                className={`p-5 rounded-xl border transition-all ${
                  isVip
                    ? "bg-gradient-to-r from-teal-50/70 via-white to-white border-teal-500 shadow-sm ring-1 ring-teal-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getCarrierLogo(q.carrierName) ? (
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={getCarrierLogo(q.carrierName)!} 
                          alt={q.carrierName} 
                          className="max-w-full max-h-full object-contain" 
                        />
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: q.carrierColor }}
                      >
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900">
                          {q.servicoName}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isVip ? "bg-teal-100 text-teal-800 border border-teal-300" : "bg-slate-100 text-slate-700"
                        }`}>
                          {q.pricingProfile}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        Executado por: <strong className="text-slate-700">{q.carrierName}</strong> • {q.targetClient}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Comparison Columns */}
                  <div className="flex items-center gap-5 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Custo Parceiro</span>
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        {q.costPrice.toFixed(2)}€
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] uppercase font-bold block ${isVip ? "text-teal-700" : "text-emerald-700"}`}>
                        Preço Cliente ({q.pricingProfile.split("/")[0].trim()})
                      </span>
                      <span className={`text-base font-mono font-extrabold ${isVip ? "text-teal-800" : "text-emerald-800"}`}>
                        {q.finalSellPrice.toFixed(2)}€
                      </span>
                    </div>

                    <div className="text-right pl-3 border-l border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Nosso Lucro</span>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          +{q.marginAmount.toFixed(2)}€
                        </span>
                        <span className="text-[10px] font-semibold px-1 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                          +{q.marginPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown details */}
                {(q.fuelAmount > 0 || isCod) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Detalhamento:</span>
                    <span>Base PVP: {q.sellPrice.toFixed(2)}€</span>
                    {q.fuelAmount > 0 && <span>+ Combustível: {q.fuelAmount.toFixed(2)}€</span>}
                    {isCod && <span>+ Taxa Cobrança: Incluída</span>}
                  </div>
                )}
              </div>
            )
          })}

          {quotes.length === 0 && (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
              Nenhuma tabela de preço disponível para a zona e peso selecionados.
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
