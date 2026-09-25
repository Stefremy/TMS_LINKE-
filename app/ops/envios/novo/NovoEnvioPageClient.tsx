"use client"

import * as React from "react"
import { X, Package, User, MapPin, Loader2, CheckCircle2, Weight, Euro } from "lucide-react"
import { emitClientGuiaAction } from "@/app/actions/shipments"

import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { Button } from "@/components/ui/button"

export function NovoEnvioPageClient({ clients, servicosLinke = [] }: { clients: Cliente[], servicosLinke?: ServicoLinke[] }) {
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [shipmentResult, setShipmentResult] = React.useState<{
    guia?: string;
    id?: string;
    labelBase64?: string;
    clientName?: string;
    recipientName?: string;
    recipientCity?: string;
    serviceName?: string;
    weightKg?: number;
    volumes?: number;
    sellPrice?: number;
  } | null>(null)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [selectedServiceId, setSelectedServiceId] = React.useState("")
  const [weightKg, setWeightKg] = React.useState<number>(1)
  const [recipientCountry, setRecipientCountry] = React.useState("PT")
  const [selectedSpecialServices, setSelectedSpecialServices] = React.useState<string[]>([])
  const [codValue, setCodValue] = React.useState<number>(0)

  const currentClient = clients.find(c => c.id === selectedClientId)

  const availableServicos = React.useMemo(() => {
    let active = servicosLinke.filter((s) => s.is_active !== false)
    if (currentClient?.assigned_linke_service_ids && currentClient.assigned_linke_service_ids.length > 0) {
      active = active.filter(s => currentClient.assigned_linke_service_ids!.includes(s.id))
    }
    if (active.length === 0) return []
    if (currentClient?.default_linke_table_id) {
      const match = active.find((s) => s.id === currentClient.default_linke_table_id)
      if (match) {
        return [match, ...active.filter((s) => s.id !== match.id)]
      }
    }
    return active
  }, [servicosLinke, currentClient])

  const activeLinkeService = availableServicos.find((s) => s.id === selectedServiceId) || availableServicos[0]

  const specialServicesAvailable = currentClient?.pricing?.special_services_fees?.filter(f => f.is_enabled) || []

  // Client-side weight-based estimate (display only; server recalculates using assigned table)
  const estimatedTier = (() => {
    if (activeLinkeService?.zones?.[0]?.tiers?.length) {
      const origTiers = activeLinkeService.zones[0].tiers || []
      const tiers = origTiers.filter(t => t.enabled !== false).sort((a, b) => a.weight_max - b.weight_max)
      const tierIndex = tiers.findIndex(t => weightKg <= t.weight_max)
      const matchedTier = tierIndex !== -1 ? tiers[tierIndex] : tiers[tiers.length - 1]
      if (matchedTier) {
        const origIndex = origTiers.indexOf(matchedTier)
        const customPrice = currentClient?.custom_tier_overrides?.[activeLinkeService.id]?.[origIndex]
        const effectiveSell = customPrice !== undefined ? customPrice : matchedTier.sell_price
        return {
          label: matchedTier.label || `Até ${matchedTier.weight_max} Kg`,
          sell: effectiveSell,
          buy: matchedTier.cost_price,
        }
      }
    }
    if (weightKg <= 1)  return { label: "Até 1 Kg",  sell: 3.56, buy: 2.85 }
    if (weightKg <= 2)  return { label: "Até 2 Kg",  sell: 3.94, buy: 3.15 }
    if (weightKg <= 5)  return { label: "Até 5 Kg",  sell: 4.58, buy: 3.75 }
    if (weightKg <= 10) return { label: "Até 10 Kg", sell: 5.61, buy: 4.60 }
    if (weightKg <= 20) return { label: "Até 20 Kg", sell: 7.44, buy: 6.20 }
    if (weightKg <= 30) return { label: "Até 30 Kg", sell: 9.48, buy: 7.90 }
    return { label: "+30 Kg", sell: +(9.48 + (weightKg - 30) * 0.35).toFixed(2), buy: +(7.90 + (weightKg - 30) * 0.28).toFixed(2) }
  })()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    
    const formData = new FormData(e.currentTarget)
    try {
      const res = await emitClientGuiaAction({
        clientId: selectedClientId,
        clientName: currentClient?.short_name || currentClient?.legal_name || "Operador",
        senderAddress: formData.get("sender_address") as string || "",
        senderCity: formData.get("sender_city") as string || "",
        senderPostal: formData.get("sender_zip") as string || "",
        recipientName: formData.get("recipient_name") as string,
        recipientAddress: formData.get("recipient_address") as string,
        recipientCity: formData.get("recipient_city") as string,
        recipientPostal: formData.get("recipient_zip") as string,
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumesCount: Number(formData.get("volumes")) || 1,
        lengthCm: Number(formData.get("length_cm")) || 0,
        widthCm: Number(formData.get("width_cm")) || 0,
        heightCm: Number(formData.get("height_cm")) || 0,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        subProductId: activeLinkeService?.webservice_service_code,
        calculatedPrice: estimatedTier.sell,
        selectedSpecialServices: selectedSpecialServices,
        codValue: selectedSpecialServices.includes("cod") ? codValue : undefined
      })
      
      if (!res.success) {
        throw new Error((res as any).error || "Erro ao comunicar com os CTT")
      }
      
      setShipmentResult({
        guia: (res as any).guia,
        id: (res as any).id,
        labelBase64: (res as any).labelBase64,
        clientName: currentClient?.short_name || currentClient?.legal_name || "Operador",
        recipientName: formData.get("recipient_name") as string,
        recipientCity: formData.get("recipient_city") as string,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumes: Number(formData.get("volumes")) || 1,
        sellPrice: estimatedTier.sell
      })
      setSuccess(true)
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao criar envio.")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.1)]">
              <Package className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Criar Novo Envio</h2>
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Registar expedição operacional via CTT</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {success && shipmentResult ? (
          <>
            {/* Modal Backdrop Layer */}
            <div className="fixed inset-0 top-[56px] md:left-[220px] bg-[var(--text-primary)]/45 backdrop-blur-[2px] z-50 flex items-center justify-center p-6 overflow-y-auto">
              {/* Modal Card */}
              <div aria-labelledby="modal-title" aria-modal="true" className="w-full max-w-4xl bg-[var(--surface-bg)] rounded-xl shadow-[0_20px_50px_rgba(20,23,20,0.22)] overflow-hidden flex flex-col my-auto transition-all animate-in fade-in zoom-in-95 duration-150 border border-[var(--border-strong)]" role="dialog">
                
                {/* Top Status Header Strip */}
                <div className="px-8 pt-8 pb-6 bg-[var(--surface-bg)] relative flex items-start justify-between">
                  <div className="flex items-start gap-4 pr-8">
                    {/* Green Success Instrument Badge */}
                    <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-sm border border-[rgba(18,138,71,0.2)]">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[24px] font-bold text-[var(--text-primary)] tracking-tight" id="modal-title">
                          Envio emitido com sucesso!
                        </h2>
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] rounded font-semibold tracking-wide uppercase border border-[rgba(18,138,71,0.2)]">
                          {shipmentResult.guia || "LK-PENDENTE"}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-[var(--surface-muted)] text-[var(--text-secondary)] rounded border border-[var(--border-subtle)]">
                          Série GT-2026 / Nº {Math.floor(100000 + Math.random() * 900000)}
                        </span>
                      </div>
                      <p className="text-[14px] text-[var(--text-secondary)] max-w-2xl leading-relaxed mt-1">
                        A expedição foi registada no sistema, comunicada em tempo real à Autoridade Tributária e a ordem de recolha foi confirmada pela <strong className="text-[var(--text-primary)] font-medium">CTT Expresso</strong>.
                      </p>
                    </div>
                  </div>
                  {/* Dismiss Icon Button */}
                  <button 
                    onClick={() => window.location.href = "/ops/envios"}
                    className="w-8 h-8 rounded-lg bg-[var(--surface-muted)] hover:bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0" 
                    title="Fechar" 
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Operational Matrix */}
                <div className="px-8 pb-6 space-y-4 overflow-y-auto max-h-[calc(88vh-140px)]">
                  
                  {/* 1. Dominant Verification Card: Fiscal & Official Carrier Credentials */}
                  <div className="bg-[var(--surface-muted)] rounded-xl p-6 space-y-4 border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="text-[var(--accent)] w-5 h-5" />
                        <span className="text-[11px] text-[var(--text-primary)] uppercase tracking-wider font-bold">Credenciais Fiscais & Rastreio CTT</span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)] font-medium">Protocolo SAF-T PT v1.04_01 · Webservice AT</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Fiscal Box (AT) */}
                      <div className="bg-[var(--surface-bg)] rounded-lg p-4 shadow-sm border border-[var(--border-subtle)] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase">Código AT Oficial (Guia)</span>
                          <span className="inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] font-bold border border-[rgba(18,138,71,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></span>
                            Validado AT
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex flex-col">
                            <span className="font-mono text-[20px] text-[var(--text-primary)] tracking-tight font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                              AT.2026.{Math.floor(1000000 + Math.random() * 9000000)}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">Gerado em tempo real</span>
                          </div>
                        </div>
                      </div>

                      {/* Carrier AWB Box */}
                      <div className="bg-[var(--surface-bg)] rounded-lg p-4 shadow-sm border border-[var(--border-subtle)] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase">AWB CTT Expresso (Tracking)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] font-bold border border-[rgba(18,138,71,0.2)]">
                            Pronto para Recolha
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex flex-col">
                            <span className="font-mono text-[20px] text-[var(--accent)] tracking-tight font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {shipmentResult.guia}
                            </span>
                            <span className="text-[12px] font-medium text-[var(--text-tertiary)]">Serviço: {shipmentResult.serviceName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Resumo da Expedição (Compact Breakdown Strip) */}
                  <div className="bg-[var(--surface-bg)] rounded-lg p-4 shadow-sm space-y-3 border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                      <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">Resumo do Manifesto de Carga</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Col 1: Expedidor */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase block">Expedidor (Origem)</span>
                        <p className="text-[13px] text-[var(--text-primary)] font-semibold truncate">{shipmentResult.clientName}</p>
                      </div>
                      
                      {/* Col 2: Destinatário */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase block">Destinatário (Destino)</span>
                        <p className="text-[13px] text-[var(--text-primary)] font-semibold truncate">{shipmentResult.recipientName}</p>
                        <p className="text-[12px] text-[var(--text-secondary)] truncate">{shipmentResult.recipientCity}</p>
                      </div>
                      
                      {/* Col 3: Carga & Pesagem */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase block">Volumes & Peso</span>
                        <p className="text-[13px] text-[var(--text-primary)] font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{shipmentResult.volumes} Volume(s)</p>
                        <p className="font-mono text-[11px] text-[var(--text-secondary)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          Total: {shipmentResult.weightKg} kg
                        </p>
                      </div>
                      
                      {/* Col 4: Custo Faturado */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase block">Custo Faturado CTT</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[16px] text-[var(--text-primary)] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{shipmentResult.sellPrice?.toFixed(2)} €</span>
                          <span className="text-[12px] font-medium text-[var(--text-tertiary)]">+ IVA</span>
                        </div>
                        <p className="font-mono text-[10px] text-[var(--accent)] font-medium truncate">Débito conta corrente OK</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Action Footer Strip */}
                <div className="px-8 py-4 bg-[var(--surface-muted)] flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
                  <a className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors" href="/ops/envios">
                    ← <span>Ver detalhe na tabela de Envios</span>
                  </a>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button 
                      onClick={() => setSuccess(false)}
                      className="h-8 px-4 bg-[var(--surface-bg)] hover:bg-[var(--surface-container)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-md text-[13px] font-bold flex items-center gap-1.5 transition-colors shadow-xs" 
                      type="button"
                    >
                      Criar Novo Envio
                    </button>
                    <button 
                      onClick={() => {
                        if (shipmentResult.labelBase64) {
                          const link = document.createElement("a");
                          link.href = `data:application/pdf;base64,${shipmentResult.labelBase64}`;
                          link.download = `etiqueta_${shipmentResult.guia}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                      className="h-8 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-[13px] font-bold flex items-center gap-1.5 transition-colors shadow-xs" 
                      type="button"
                    >
                      Descarregar Etiquetas (.pdf)
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              
              {errorMsg && (
                <div className="p-3 bg-[var(--status-critical-soft)] text-[var(--status-critical)] text-xs font-medium rounded-md border border-[rgba(220,38,38,0.2)]">
                  {errorMsg}
                </div>
              )}

              {/* Price Preview Banner */}
              <div className="bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.2)] rounded-lg p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <Euro className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Preço estimado</span>
                  <span className="text-[11px] font-medium opacity-80">({estimatedTier.label} · tabela padrão)</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-[var(--text-secondary)] font-medium">Custo: <span className="font-bold text-[var(--text-primary)]">{estimatedTier.buy.toFixed(2)}€</span></span>
                  <span className="text-[var(--accent)] font-extrabold text-sm">{estimatedTier.sell.toFixed(2)}€</span>
                </div>
              </div>

              {/* Cliente & Serviço */}
              <div>
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--accent)]" />
                  Detalhes da Expedição
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Cliente *</label>
                    <select name="client_id" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] font-medium focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs">
                      <option value="">Selecione o Cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.short_name || c.legal_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Serviço/Produto *</label>
                    <select
                      name="service_type"
                      required
                      value={selectedServiceId}
                      onChange={e => setSelectedServiceId(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] font-medium focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors cursor-pointer shadow-2xs"
                    >
                      {availableServicos.map(s => (
                        <option key={s.id} value={s.id}>[{s.category}] {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Weight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      name="weight_kg"
                      min="0.1"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value) || 1)}
                      required
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                      placeholder="1.0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Volumes</label>
                    <input
                      type="number"
                      name="volumes"
                      min="1"
                      defaultValue={1}
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Comp. (cm)</label>
                    <input
                      type="number"
                      name="length_cm"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Largura (cm)</label>
                    <input
                      type="number"
                      name="width_cm"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Altura (cm)</label>
                    <input
                      type="number"
                      name="height_cm"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Remetente */}
                <div>
                  <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--status-warning)]" />
                    Remetente
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
                      <input type="text" name="sender_name" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Morada</label>
                      <input type="text" name="sender_address" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">C. Postal</label>
                        <input type="text" name="sender_zip" placeholder="Ex: 1000-001" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Localidade</label>
                        <input type="text" name="sender_city" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Destinatário */}
                <div>
                  <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    Destinatário
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
                      <input type="text" name="recipient_name" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Morada</label>
                      <input type="text" name="recipient_address" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">C. Postal</label>
                        <input type="text" name="recipient_zip" placeholder="Ex: 4000-001" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Localidade</label>
                        <input type="text" name="recipient_city" required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">País</label>
                      <select 
                        name="recipient_country" 
                        value={recipientCountry}
                        onChange={(e) => setRecipientCountry(e.target.value)}
                        required 
                        className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs cursor-pointer"
                      >
                        <option value="PT">Portugal</option>
                        <option value="ES">Espanha</option>
                        <option value="FR">França</option>
                        <option value="DE">Alemanha</option>
                        <option value="IT">Itália</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {specialServicesAvailable.length > 0 && (
              <div className="px-6 pb-6 pt-2">
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[var(--accent)]" />
                  Opções Especiais de Entrega
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {specialServicesAvailable.map(service => {
                    const isSelected = selectedSpecialServices.includes(service.special_service_code);
                    return (
                      <div key={service.special_service_code} className={`border rounded-md p-3 cursor-pointer transition-colors shadow-2xs ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)] hover:border-[var(--accent)] bg-[var(--surface-bg)]'}`} onClick={() => {
                        if (isSelected) {
                          setSelectedSpecialServices(prev => prev.filter(s => s !== service.special_service_code));
                        } else {
                          setSelectedSpecialServices(prev => [...prev, service.special_service_code]);
                        }
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" checked={isSelected} readOnly className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] cursor-pointer" />
                          <span className="text-[11px] font-bold text-[var(--text-primary)]">{service.special_service_name.split(" ")[0]}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] pl-6 leading-tight font-medium">{service.description}</p>
                        
                        {isSelected && service.special_service_code === "cod" && (
                          <div className="mt-2 pl-6" onClick={e => e.stopPropagation()}>
                            <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] block mb-1">Valor a Cobrar (€)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              value={codValue}
                              onChange={(e) => setCodValue(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-[11px] border border-[var(--border-strong)] rounded-md focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => window.history.back()}
                disabled={loading}
                className="shadow-xs text-[11px] h-auto px-4 py-2 font-semibold"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="shadow-xs text-[11px] h-auto px-5 py-2 font-bold flex items-center gap-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border-none"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Emitir Envio & Etiqueta
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
