"use client"

import * as React from "react"
import { X, Package, User, MapPin, Loader2, CheckCircle2, Weight, Euro, Download, FileText, ExternalLink, Check, Printer } from "lucide-react"
import { emitClientGuiaAction } from "@/app/actions/shipments"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"

import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { Button } from "@/components/ui/button"
import { resolveInternationalZone, OFFICIAL_LINKE_ZONES } from "@/lib/services/geo/international-zones"
import { downloadCttLabel, printCttLabel } from "@/lib/label-utils"

export function NovoEnvioPageClient({ clients, servicosLinke = [] }: { clients: Cliente[], servicosLinke?: ServicoLinke[] }) {
  // Lock to "GO Linke" for operation purposes
  const displayClients = React.useMemo(() => {
    const ops = clients.filter(c => {
      const name = c.short_name || c.legal_name || ""
      return name.toLowerCase().includes("go linke")
    })
    return ops.length > 0 ? ops : clients
  }, [clients])

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
    carrierName?: string;
    weightKg?: number;
    volumes?: number;
    sellPrice?: number;
    atCode?: string;
    moloniDoc?: {
      id?: number;
      number?: string;
      pdfUrl?: string | null;
    };
  } | null>(null)
  const [emitMoloniGt, setEmitMoloniGt] = React.useState(false)
  const [emittingMoloni, setEmittingMoloni] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [selectedClientId, setSelectedClientId] = React.useState(displayClients[0]?.id || "")
  const [selectedServiceId, setSelectedServiceId] = React.useState("")
  const [weightKg, setWeightKg] = React.useState<number>(1)
  const [recipientCountry, setRecipientCountry] = React.useState("PT")
  const [selectedSpecialServices, setSelectedSpecialServices] = React.useState<string[]>([])
  const [codValue, setCodValue] = React.useState<number>(0)

  // Address inputs state
  const [isEditingSender, setIsEditingSender] = React.useState(false)
  const [senderName, setSenderName] = React.useState("")
  const [senderAddress, setSenderAddress] = React.useState("")
  const [senderZip, setSenderZip] = React.useState("")
  const [senderCity, setSenderCity] = React.useState("")

  const [recipientName, setRecipientName] = React.useState("")
  const [recipientAddress, setRecipientAddress] = React.useState("")
  const [recipientZip, setRecipientZip] = React.useState("")
  const [recipientCity, setRecipientCity] = React.useState("")
  const [recipientPhone, setRecipientPhone] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")

  const currentClient = clients.find(c => c.id === selectedClientId)

  // Auto-fill sender when client is selected
  React.useEffect(() => {
    if (currentClient) {
      if (!senderName) setSenderName(currentClient.short_name || currentClient.legal_name || "")
      if (!senderAddress) setSenderAddress(currentClient.address || "")
      if (!senderZip) setSenderZip(currentClient.postal_code || "")
      if (!senderCity) setSenderCity(currentClient.city || "")
    }
  }, [currentClient])

  // Postal code lookup hooks
  const senderPostalLookup = usePostalCodeLookup({
    country: "PT",
    onFound: (info) => {
      setSenderCity(info.city)
      if (!senderAddress && info.street) {
        setSenderAddress(`${info.street}, nº `)
      }
    }
  })

  const recipientPostalLookup = usePostalCodeLookup({
    country: recipientCountry,
    onFound: (info) => {
      setRecipientCity(info.city)
      if (!recipientAddress && info.street) {
        setRecipientAddress(`${info.street}, nº `)
      }
    }
  })

  const resolvedDestinationZone = React.useMemo(() => {
    if (recipientCountry === "PT") return "PT-CONT"
    if (recipientCountry === "ES") return "ES-PENIN"
    return resolveInternationalZone(recipientCountry) || "INTL"
  }, [recipientCountry])

  const availableServicos = React.useMemo(() => {
    let active = servicosLinke.filter((s) => s.is_active !== false)
    if (currentClient?.assigned_linke_service_ids && currentClient.assigned_linke_service_ids.length > 0) {
      active = active.filter(s => currentClient.assigned_linke_service_ids!.includes(s.id))
    }
    if (active.length === 0) return []

    // Prioritize services that explicitly cover the destination zone
    const targetZone = resolvedDestinationZone
    active = [...active].sort((a, b) => {
      const aCovers = (a.allowed_zones || []).includes(targetZone) || a.zones.some(z => z.zone_code === targetZone)
      const bCovers = (b.allowed_zones || []).includes(targetZone) || b.zones.some(z => z.zone_code === targetZone)
      if (aCovers && !bCovers) return -1
      if (!aCovers && bCovers) return 1
      return 0
    })

    if (currentClient?.default_linke_table_id) {
      const match = active.find((s) => s.id === currentClient.default_linke_table_id)
      if (match) {
        return [match, ...active.filter((s) => s.id !== match.id)]
      }
    }
    return active
  }, [servicosLinke, currentClient, resolvedDestinationZone])

  const activeLinkeService = availableServicos.find((s) => s.id === selectedServiceId) || availableServicos[0]
  const isCorreos = activeLinkeService?.name?.toLowerCase().includes("correos") || (activeLinkeService as any)?.carrier_code === "correos"
  const carrierDisplayName = activeLinkeService ? (isCorreos ? "Correos Express" : "CTT Expresso") : "Transportadora"

  const specialServicesAvailable = React.useMemo(() => {
    if (!currentClient?.pricing?.special_services_fees) return []
    const isCorreos = activeLinkeService?.name?.toLowerCase().includes("correos")
    return currentClient.pricing.special_services_fees.filter((f) => {
      if (!f.is_enabled) return false
      if (isCorreos) return f.special_service_code.startsWith("correos_")
      return !f.special_service_code.startsWith("correos_")
    })
  }, [currentClient, activeLinkeService])

  // Client-side weight-based estimate (display only; server recalculates using assigned table)
  const estimatedTier = (() => {
    const targetZone = activeLinkeService?.zones?.find(
      (z) => z.zone_code === resolvedDestinationZone || 
             (resolvedDestinationZone && z.zone_name.toLowerCase().includes(resolvedDestinationZone.toLowerCase())) ||
             (resolvedDestinationZone === "PT-CONT" && z.zone_code === "PT-CONT")
    ) || activeLinkeService?.zones?.[0]

    if (targetZone?.tiers?.length) {
      const origTiers = targetZone.tiers || []
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
          zoneName: targetZone.zone_name,
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
        clientName: isEditingSender ? senderName : (currentClient?.short_name || currentClient?.legal_name || "Operador"),
        senderAddress: isEditingSender ? senderAddress : (currentClient?.address || ""),
        senderCity: isEditingSender ? senderCity : (currentClient?.city || ""),
        senderPostal: isEditingSender ? senderZip : (currentClient?.postal_code || ""),
        recipientName: formData.get("recipient_name") as string,
        recipientAddress: formData.get("recipient_address") as string,
        recipientCity: formData.get("recipient_city") as string,
        recipientPostal: formData.get("recipient_zip") as string,
        recipientCountry: recipientCountry || "PT",
        recipientPhone: (formData.get("recipient_phone") as string) || recipientPhone || undefined,
        recipientEmail: (formData.get("recipient_email") as string) || recipientEmail || undefined,
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumesCount: Number(formData.get("volumes")) || 1,
        lengthCm: Number(formData.get("length_cm")) || 0,
        widthCm: Number(formData.get("width_cm")) || 0,
        heightCm: Number(formData.get("height_cm")) || 0,
        serviceId: activeLinkeService?.id,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        subProductId: activeLinkeService?.webservice_service_code,
        webserviceConnectionId: activeLinkeService?.webservice_connection_id,
        calculatedPrice: estimatedTier.sell,
        selectedSpecialServices: selectedSpecialServices,
        codValue: selectedSpecialServices.includes("cod") ? codValue : undefined
      })
      
      if (!res.success) {
        throw new Error((res as any).error || `Erro ao comunicar com a transportadora (${carrierDisplayName})`)
      }
      
      const newResult: any = {
        guia: (res as any).guia,
        id: (res as any).id,
        labelBase64: (res as any).labelBase64,
        clientName: currentClient?.short_name || currentClient?.legal_name || "Operador",
        recipientName: formData.get("recipient_name") as string,
        recipientCity: formData.get("recipient_city") as string,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        carrierName: carrierDisplayName,
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumes: Number(formData.get("volumes")) || 1,
        sellPrice: estimatedTier.sell,
        atCode: `AT.2026.${Math.floor(1000000 + Math.random() * 9000000)}`
      }

      // Se a opção Moloni estiver ativa, emite a Guia de Transporte oficial no Moloni
      if (emitMoloniGt && (res as any).id) {
        try {
          const { emitMoloniWaybillForShipmentAction } = await import("@/app/actions/moloni")
          const mRes = await emitMoloniWaybillForShipmentAction((res as any).id)
          if (mRes.success) {
            newResult.moloniDoc = {
              id: mRes.documentId,
              number: mRes.documentNumber,
              pdfUrl: mRes.pdfUrl,
            }
          } else {
            console.warn("Aviso ao emitir Guia no Moloni:", mRes.error)
          }
        } catch (mErr: any) {
          console.warn("Erro ao contactar Moloni:", mErr?.message)
        }
      }

      setShipmentResult(newResult)
      setSuccess(true)
      
      // Auto-download da etiqueta assim que o envio é criado
      if ((res as any).labelBase64) {
        setTimeout(() => {
          downloadCttLabel((res as any).labelBase64, `etiqueta_${(res as any).guia || "envio"}.pdf`)
        }, 150);
      }

      // Reset the form so they can type a new shipment immediately
      formRef.current?.reset()
      setWeightKg(1)
      
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao criar envio.")
      setLoading(false)
    }
  }

  const handleEmitMoloniNow = async () => {
    if (!shipmentResult?.id) return
    setEmittingMoloni(true)
    try {
      const { emitMoloniWaybillForShipmentAction } = await import("@/app/actions/moloni")
      const res = await emitMoloniWaybillForShipmentAction(shipmentResult.id)
      if (res.success) {
        setShipmentResult((prev) => prev ? ({
          ...prev,
          moloniDoc: {
            id: res.documentId,
            number: res.documentNumber,
            pdfUrl: res.pdfUrl
          }
        }) : null)
      } else {
        alert(res.error || "Não foi possível emitir no Moloni. Verifique se a conta está conectada em Faturação.")
      }
    } catch (e: any) {
      alert("Erro ao comunicar com o Moloni: " + (e?.message || "Tente novamente."))
    } finally {
      setEmittingMoloni(false)
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
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                Registar expedição operacional {activeLinkeService ? `via ${carrierDisplayName}` : "multicarrier"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            
            {success && shipmentResult && (
              <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <span>Guia Emitida com Sucesso!</span>
                        <span className="font-mono text-xs bg-slate-100 border border-slate-200 text-slate-900 px-2 py-0.5 rounded-md font-semibold">
                          {shipmentResult.guia}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        O envio foi registado com o serviço <strong>{shipmentResult.serviceName}</strong>.
                      </p>
                    </div>
                  </div>
                  {(shipmentResult as any).dbWarning && (
                    <div className="mt-2 p-3 bg-amber-50 text-amber-700 text-xs font-medium rounded-md border border-amber-200">
                      <strong>Aviso de Sistema:</strong> O envio foi gerado na transportadora, mas houve um erro ao guardar na base de dados: {(shipmentResult as any).dbWarning}. Por favor verifique ou crie novamente para que apareça na lista.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <a
                    href="/ops/envios"
                    className="bg-slate-900 hover:opacity-90 text-white px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Ver no Painel</span>
                  </a>
                  <a
                    href="/ops/envios"
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors"
                  >
                    <span>Ver no Histórico</span>
                  </a>
                  {shipmentResult.labelBase64 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => printCttLabel(shipmentResult.labelBase64!)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir Etiqueta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCttLabel(shipmentResult.labelBase64!, `etiqueta_${shipmentResult.guia}.pdf`)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Descarregar Etiqueta CTT</span>
                        <span className="sm:hidden">Etiqueta CTT</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-semibold">
                      Sem etiqueta gerada — usa "Solicitar" no detalhe do envio
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
              
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
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Cliente (Bloqueado Operações) *</label>
                    <select name="client_id" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} disabled required className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] font-bold focus:outline-none bg-[var(--surface-muted)] text-[var(--text-primary)] transition-colors cursor-not-allowed shadow-2xs opacity-80">
                      {displayClients.map(c => (
                        <option key={c.id} value={c.id}>{c.short_name || c.legal_name}</option>
                      ))}
                    </select>
                    <input type="hidden" name="client_id" value={selectedClientId} />
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--status-warning)]" />
                      Remetente
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIsEditingSender(!isEditingSender)} 
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
                      >
                        {isEditingSender ? "Cancelar" : "Editar"}
                      </button>
                      <span className="text-[10px] text-[var(--text-secondary)] font-semibold border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
                        {currentClient ? "Conta Ativa" : "Selecione"}
                      </span>
                    </div>
                  </div>
                  
                  {!isEditingSender ? (
                    <div className="space-y-2 bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border-subtle)]">
                      <div className="text-xs text-[var(--text-primary)] font-bold">
                        {senderName || currentClient?.short_name || "Empresa Cliente"}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        {senderAddress || currentClient?.address 
                          ? `${senderAddress || currentClient?.address}, ${senderZip || currentClient?.postal_code || ""} ${senderCity || currentClient?.city || ""}`.trim()
                          : "Sede Comercial da Empresa"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Nome</label>
                        <input 
                          type="text" 
                          name="sender_name" 
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          required 
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">C. Postal</label>
                            {senderPostalLookup.loading && (
                              <span className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-1 font-mono">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> A validar...
                              </span>
                            )}
                            {senderPostalLookup.status === "valid" && (
                              <span className="text-[9px] text-[var(--accent)] font-semibold flex items-center gap-0.5 truncate max-w-[120px]" title={senderPostalLookup.info?.city}>
                                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> {senderPostalLookup.info?.city}
                              </span>
                            )}
                            {senderPostalLookup.status === "invalid" && (
                              <span className="text-[9px] text-[var(--status-warning)] font-medium">
                                Não registado
                              </span>
                            )}
                          </div>
                          <input 
                            type="text" 
                            name="sender_zip" 
                            placeholder="Ex: 1000-001" 
                            value={senderZip}
                            onChange={(e) => {
                              const formatted = senderPostalLookup.lookup(e.target.value, "PT")
                              setSenderZip(formatted)
                            }}
                            required 
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Localidade</label>
                          <input 
                            type="text" 
                            name="sender_city" 
                            value={senderCity}
                            onChange={(e) => setSenderCity(e.target.value)}
                            required 
                            className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Morada</label>
                        <input 
                          type="text" 
                          name="sender_address" 
                          value={senderAddress}
                          onChange={(e) => setSenderAddress(e.target.value)}
                          placeholder="Rua, avenida, número..."
                          required 
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                        {senderPostalLookup.info?.streets && senderPostalLookup.info.streets.length > 1 && (
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] text-[var(--text-tertiary)] font-medium">Ruas:</span>
                            {senderPostalLookup.info.streets.slice(0, 4).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setSenderAddress(`${st}, nº `)}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Destinatário */}
                <div>
                  <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    Destinatário
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Nome *</label>
                        <input 
                          type="text" 
                          name="recipient_name" 
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          required 
                          placeholder="Nome da pessoa ou empresa"
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">País de Destino *</label>
                        <select 
                          name="recipient_country" 
                          value={recipientCountry}
                          onChange={(e) => {
                            const c = e.target.value
                            setRecipientCountry(c)
                            setRecipientZip("")
                            setRecipientCity("")
                            recipientPostalLookup.reset()
                          }}
                          required 
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] font-semibold focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs cursor-pointer"
                        >
                          <optgroup label="Península Ibérica">
                            <option value="PT">Portugal (PT)</option>
                            <option value="ES">Espanha (ES)</option>
                          </optgroup>
                          <optgroup label="Europa 1 (EU 1)">
                            <option value="DE">Alemanha (DE)</option>
                            <option value="FR">França (FR)</option>
                            <option value="IT">Itália (IT)</option>
                            <option value="GB">Reino Unido (GB)</option>
                            <option value="BE">Bélgica (BE)</option>
                            <option value="NL">Holanda (NL)</option>
                            <option value="AT">Áustria (AT)</option>
                            <option value="SE">Suécia (SE)</option>
                            <option value="DK">Dinamarca (DK)</option>
                            <option value="IE">Irlanda (IE)</option>
                            <option value="LU">Luxemburgo (LU)</option>
                            <option value="MC">Mónaco (MC)</option>
                          </optgroup>
                          <optgroup label="Europa 2 (EU 2)">
                            <option value="PL">Polónia (PL)</option>
                            <option value="CZ">República Checa (CZ)</option>
                            <option value="RO">Roménia (RO)</option>
                            <option value="BG">Bulgária (BG)</option>
                            <option value="HU">Hungria (HU)</option>
                            <option value="HR">Croácia (HR)</option>
                            <option value="SK">Eslováquia (SK)</option>
                            <option value="SI">Eslovénia (SI)</option>
                            <option value="EE">Estónia (EE)</option>
                            <option value="LV">Letónia (LV)</option>
                            <option value="LT">Lituânia (LT)</option>
                            <option value="UA">Ucrânia (UA)</option>
                          </optgroup>
                          <optgroup label="Europa 3 (EU 3)">
                            <option value="CH">Suíça (CH)</option>
                            <option value="NO">Noruega (NO)</option>
                            <option value="FI">Finlândia (FI)</option>
                            <option value="GR">Grécia (GR)</option>
                            <option value="AD">Andorra (AD)</option>
                            <option value="GI">Gibraltar (GI)</option>
                            <option value="LI">Liechtenstein (LI)</option>
                          </optgroup>
                          <optgroup label="América do Norte (NA)">
                            <option value="US">Estados Unidos (US)</option>
                            <option value="CA">Canadá (CA)</option>
                            <option value="MX">México (MX)</option>
                            <option value="PR">Porto Rico (PR)</option>
                          </optgroup>
                          <optgroup label="América do Sul (SA)">
                            <option value="BR">Brasil (BR)</option>
                            <option value="AR">Argentina (AR)</option>
                            <option value="CL">Chile (CL)</option>
                            <option value="CO">Colômbia (CO)</option>
                            <option value="PE">Peru (PE)</option>
                            <option value="UY">Uruguai (UY)</option>
                            <option value="VE">Venezuela (VE)</option>
                            <option value="PA">Panamá (PA)</option>
                          </optgroup>
                          <optgroup label="Oriente 1 (O1)">
                            <option value="JP">Japão (JP)</option>
                            <option value="KR">Coreia do Sul (KR)</option>
                            <option value="SG">Singapura (SG)</option>
                            <option value="HK">Hong Kong (HK)</option>
                            <option value="TH">Tailândia (TH)</option>
                            <option value="TW">Taiwan (TW)</option>
                            <option value="EG">Egito (EG)</option>
                          </optgroup>
                          <optgroup label="Oriente 2 (O2)">
                            <option value="CN">China (CN)</option>
                            <option value="AU">Austrália (AU)</option>
                            <option value="AE">Emiratos Árabes Unidos (AE)</option>
                            <option value="IN">Índia (IN)</option>
                            <option value="IL">Israel (IL)</option>
                            <option value="TR">Turquia (TR)</option>
                            <option value="NZ">Nova Zelândia (NZ)</option>
                            <option value="QA">Qatar (QA)</option>
                          </optgroup>
                          <optgroup label="África (A)">
                            <option value="AO">Angola (AO)</option>
                            <option value="CV">Cabo Verde (CV)</option>
                            <option value="MZ">Moçambique (MZ)</option>
                            <option value="ZA">África do Sul (ZA)</option>
                            <option value="MA">Marrocos (MA)</option>
                            <option value="NG">Nigéria (NG)</option>
                            <option value="SN">Senegal (SN)</option>
                            <option value="TN">Tunísia (TN)</option>
                          </optgroup>
                        </select>
                        {resolvedDestinationZone && (
                          <div className="pt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                            <span>Zona Linke:</span>
                            <span className="font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                              {resolvedDestinationZone}
                            </span>
                            {OFFICIAL_LINKE_ZONES[resolvedDestinationZone] && (
                              <span className="text-[9px] text-[var(--text-tertiary)] truncate max-w-[150px]">
                                ({OFFICIAL_LINKE_ZONES[resolvedDestinationZone].name})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                            {recipientCountry === "PT" ? "C. Postal (PT)" : recipientCountry === "ES" ? "C. Postal (ES)" : "C. Postal"} *
                          </label>
                          {recipientPostalLookup.loading && (
                            <span className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-1 font-mono">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> A validar...
                            </span>
                          )}
                          {recipientPostalLookup.status === "valid" && (
                            <span className="text-[9px] text-[var(--accent)] font-semibold flex items-center gap-0.5 truncate max-w-[120px]" title={recipientPostalLookup.info?.city}>
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> {recipientPostalLookup.info?.city}
                            </span>
                          )}
                          {recipientPostalLookup.status === "invalid" && (
                            <span className="text-[9px] text-[var(--status-warning)] font-medium">
                              Não registado
                            </span>
                          )}
                        </div>
                        <input 
                          type="text" 
                          name="recipient_zip" 
                          placeholder={recipientCountry === "ES" ? "Ex: 28001" : recipientCountry === "PT" ? "Ex: 4000-001" : "Código postal"} 
                          value={recipientZip}
                          onChange={(e) => {
                            const formatted = recipientPostalLookup.lookup(e.target.value, recipientCountry)
                            setRecipientZip(formatted)
                          }}
                          required 
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Localidade / Cidade *</label>
                        <input 
                          type="text" 
                          name="recipient_city" 
                          value={recipientCity}
                          onChange={(e) => setRecipientCity(e.target.value)}
                          required 
                          placeholder="Cidade ou localidade"
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Morada *</label>
                      <input 
                        type="text" 
                        name="recipient_address" 
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Rua, avenida, número, andar..."
                        required 
                        className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                      />
                      {recipientPostalLookup.info?.streets && recipientPostalLookup.info.streets.length > 1 && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] text-[var(--text-tertiary)] font-medium">Ruas:</span>
                          {recipientPostalLookup.info.streets.slice(0, 4).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setRecipientAddress(`${st}, nº `)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Telefone / Telemóvel</label>
                        <input 
                          type="tel" 
                          name="recipient_phone" 
                          placeholder="910000000" 
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Email (Notificação)</label>
                        <input 
                          type="email" 
                          name="recipient_email" 
                          placeholder="cliente@email.com" 
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                      </div>
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
                        
                        {isSelected && (service.special_service_code === "cod" || service.special_service_code === "correos_cod") && (
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

            {/* Opção Exclusiva de Operações (Ops): Emissão de Guia no Moloni */}
            <div className="px-6 pb-2">
              <div className={`p-4 rounded-xl border transition-all ${emitMoloniGt ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/40 shadow-xs" : "bg-[var(--surface-muted)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="emit_moloni_gt"
                    checked={emitMoloniGt}
                    onChange={(e) => setEmitMoloniGt(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                  />
                  <div className="flex-1 cursor-pointer" onClick={() => setEmitMoloniGt(!emitMoloniGt)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label htmlFor="emit_moloni_gt" className="text-[12px] font-bold text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span>Emitir Guia de Transporte Oficial no Moloni (GT)</span>
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        Consumíveis GO Linke
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                      Cria e regista formalmente a <strong>Guia de Transporte (GT)</strong> na conta Moloni da GO Linke com comunicação à Autoridade Tributária para saída de stock/consumíveis. Se desmarcado, emite apenas a etiqueta da transportadora.
                    </p>
                  </div>
                </div>
              </div>
            </div>

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
      </div>
    </div>
  )
}
