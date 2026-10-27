"use client"

import * as React from "react"
import { X, Package, User, MapPin, Loader2, CheckCircle2, Weight, Euro, Download, FileText, ExternalLink, Check, Printer, BookmarkCheck } from "lucide-react"
import { emitClientGuiaAction } from "@/app/actions/shipments"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"
import { useRecipientAgenda } from "@/lib/hooks/useRecipientAgenda"

import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { Button } from "@/components/ui/button"
import { OFFICIAL_LINKE_ZONES } from "@/lib/services/geo/international-zones"
import { getServiceDestinationCountries, getServiceDestinationZone } from "@/lib/services/service-destinations"
import { calculateShipmentQuote, getClientSpecialFees } from "@/lib/pricing/calculate-shipment-quote"
import { readCttExportForm } from "@/lib/services/ctt/export-details"
import { getCttRecipientContactError, hasCttRecipientMobilePhone } from "@/lib/services/ctt/recipient-contact"
import { CttExportFields } from "@/components/shipments/CttExportFields"
import { getServiceDisplayLabel } from "@/lib/services/ctt/service-identity"
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
  const submissionRef = React.useRef(false)
  const pageTopRef = React.useRef<HTMLDivElement>(null)
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
    dbWarning?: string | null;
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

  // Agenda de Destinatários
  const [saveToAgenda, setSaveToAgenda] = React.useState(false)
  const [showAgendaDropdown, setShowAgendaDropdown] = React.useState(false)
  const { recipients: savedRecipients, loading: loadingAgenda, error: agendaError } =
    useRecipientAgenda(selectedClientId, showAgendaDropdown)

  React.useEffect(() => {
    if (!success || !shipmentResult?.id) return
    pageTopRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })
  }, [success, shipmentResult?.id])

  const handleSelectRecipient = (r: any) => {
    const country = (r.country || "PT").trim().toUpperCase()
    if (!destinationCountries.some(option => option.code === country)) {
      setErrorMsg("O país deste destinatário não está disponível no serviço selecionado. Escolha outro serviço antes de carregar o destinatário.")
      setShowAgendaDropdown(false)
      return
    }
    setRecipientName(r.name || "")
    setRecipientAddress(r.address || "")
    setRecipientZip(r.postal_code || "")
    setRecipientCity(r.city || "")
    setRecipientCountry(country)
    setRecipientPhone(r.phone || "")
    setRecipientEmail(r.email || "")
    setShowAgendaDropdown(false)
  }

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

  const availableServicos = React.useMemo(() => {
    let active = servicosLinke.filter((s) => s.is_active !== false)
    if (Array.isArray(currentClient?.assigned_linke_service_ids)) {
      active = active.filter(s => currentClient!.assigned_linke_service_ids!.includes(s.id))
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
  const destinationCountries = React.useMemo(() => getServiceDestinationCountries(activeLinkeService), [activeLinkeService])
  const resolvedDestinationZone = activeLinkeService ? getServiceDestinationZone(activeLinkeService, recipientCountry, recipientZip) : ""
  const resetRecipientPostal = recipientPostalLookup.reset

  React.useEffect(() => {
    if (!activeLinkeService || destinationCountries.some(country => country.code === recipientCountry)) return
    const nextCountry = destinationCountries.length === 1 ? destinationCountries[0].code : ""
    if (recipientCountry === nextCountry) return
    setRecipientCountry(nextCountry)
    setRecipientZip("")
    setRecipientCity("")
    resetRecipientPostal()
  }, [activeLinkeService, destinationCountries, recipientCountry, resetRecipientPostal])
  const isCorreos = (activeLinkeService?.preferred_carrier_name || activeLinkeService?.name || "").toLowerCase().includes("correos")
  const carrierDisplayName = activeLinkeService ? (isCorreos ? "Correos Express" : "CTT Expresso") : "Transportadora"

  const specialServicesAvailable = React.useMemo(() => {
    if (!currentClient) return []
    return getClientSpecialFees(currentClient).filter(f => f.is_enabled &&
      f.special_service_code.startsWith("correos_") === isCorreos)
  }, [currentClient, isCorreos])

  const activeSpecialServices = React.useMemo(() => selectedSpecialServices.filter(code =>
    specialServicesAvailable.some(f => f.special_service_code === code)), [selectedSpecialServices, specialServicesAvailable])

  const estimatedTier = React.useMemo(() => {
    try {
      if (!currentClient || !activeLinkeService) throw new Error("Selecione um cliente e um serviço disponível.")
      if (!destinationCountries.length) throw new Error("Este serviço não tem países de destino com tarifas configuradas.")
      if (!destinationCountries.some(country => country.code === recipientCountry)) throw new Error("Selecione um país disponível para este serviço.")
      const quote = calculateShipmentQuote(weightKg, currentClient, activeLinkeService,
        recipientCountry, recipientZip, activeSpecialServices, codValue)
      return { label: quote.tierLabel, sell: quote.totalPrice, buy: quote.buyPrice, error: null }
    } catch (error) {
      return { label: "Preço indisponível", sell: 0, buy: 0,
        error: error instanceof Error ? error.message : "Não foi possível calcular a tarifa." }
    }
  }, [weightKg, currentClient, activeLinkeService, destinationCountries, recipientCountry, recipientZip, activeSpecialServices, codValue])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submissionRef.current) return
    if (estimatedTier.error) {
      setErrorMsg(estimatedTier.error)
      return
    }
    submissionRef.current = true
    setLoading(true)
    setSuccess(false)
    setErrorMsg("")

    try {
      const formData = new FormData(e.currentTarget)
      if (!isCorreos && recipientCountry !== "PT") {
        const contactError = getCttRecipientContactError({ country: recipientCountry,
          phone: (formData.get("recipient_phone") as string) || recipientPhone,
          email: (formData.get("recipient_email") as string) || recipientEmail,
        })
        if (contactError) throw new Error(contactError)
      }
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
        lengthCm: Number(formData.get("length_cm")),
        widthCm: Number(formData.get("width_cm")),
        heightCm: Number(formData.get("height_cm")),
        serviceId: activeLinkeService?.id,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        subProductId: activeLinkeService?.webservice_service_code,
        webserviceConnectionId: activeLinkeService?.webservice_connection_id,
        calculatedPrice: estimatedTier.sell,
        selectedSpecialServices: activeSpecialServices,
        codValue: activeSpecialServices.some(code => code === "cod" || code === "correos_cod") ? codValue : undefined,
        cttExportDetails: !isCorreos && recipientCountry !== "PT" ? readCttExportForm(formData) : undefined,
      })
      
      if (!res.success) {
        throw new Error((res as any).error || `Erro ao comunicar com a transportadora (${carrierDisplayName})`)
      }
      
      const newResult: any = {
        guia: (res as any).guia,
        id: (res as any).id,
        labelBase64: (res as any).labelBase64,
        dbWarning: res.dbWarning,
        clientName: currentClient?.short_name || currentClient?.legal_name || "Operador",
        recipientName: formData.get("recipient_name") as string,
        recipientCity: formData.get("recipient_city") as string,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        carrierName: carrierDisplayName,
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumes: Number(formData.get("volumes")) || 1,
        sellPrice: res.sellPrice,
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

      // Guardar na Agenda se selecionado
      if (saveToAgenda && selectedClientId) {
        import("@/app/actions/destinatarios").then(m => {
          m.saveDestinatarioAction({
            client_id: selectedClientId,
            name: (formData.get("recipient_name") as string) || recipientName,
            address: (formData.get("recipient_address") as string) || recipientAddress,
            postal_code: (formData.get("recipient_zip") as string) || recipientZip,
            city: (formData.get("recipient_city") as string) || recipientCity,
            country: recipientCountry || "PT",
            phone: (formData.get("recipient_phone") as string) || recipientPhone || undefined,
            email: (formData.get("recipient_email") as string) || recipientEmail || undefined,
            observations: "Criado via Envio OPS"
          }).catch(() => {})
        }).catch(() => {})
      }
      
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
    } finally {
      submissionRef.current = false
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
    <div ref={pageTopRef} className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 scroll-mt-20 [--accent:#128A47] [--accent-hover:#0E6C37] [--accent-active:#0B572D] [--accent-soft:#EAF5EE] [--status-success:#128A47] [--status-success-soft:#EAF5EE] [--status-info:#596F7C] [--status-info-soft:#EBF0F2]">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Novo envio</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Registe uma expedição operacional {activeLinkeService ? `via ${carrierDisplayName}` : "multicarrier"}.
        </p>
      </header>
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-bg)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white border border-[var(--accent)]">
              <Package className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Detalhes da expedição</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Confirme os dados do remetente, destinatário e serviço antes de emitir.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form ref={formRef} onSubmit={handleSubmit} aria-busy={loading} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-8">
            
            {success && shipmentResult && (
              <div className="bg-white border border-slate-200 border-l-4 border-l-[#718774] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-md bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
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
                      <strong>Envio aceite — gravação a verificar:</strong> {(shipmentResult as any).dbWarning} Não volte a criar este envio. Confirme o registo no histórico ou contacte o suporte.
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
                        className="bg-[#128A47] hover:bg-[#0E6C37] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Descarregar Etiqueta CTT</span>
                        <span className="sm:hidden">Etiqueta CTT</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-semibold">
                      Envio criado. A etiqueta oficial não está disponível. Consulte o envio {shipmentResult.guia} no portal da transportadora ou contacte o apoio para obter a etiqueta.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-[#526B57] hover:text-[#3A4F3F] text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
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

              {estimatedTier.error && (
                <p className="text-xs text-amber-700" role="status">{estimatedTier.error}</p>
              )}
              {/* Price Preview Banner */}
              <div className="bg-[var(--accent)] border border-[var(--accent)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 text-white">
                  <Euro className="w-5 h-5 mt-0.5" strokeWidth={1.75} />
                  <div>
                    <div className="text-sm font-semibold">Preço estimado</div>
                    <div className="mt-0.5 text-xs text-white">{estimatedTier.label} · inclui combustível e extras</div>
                  </div>
                </div>
                <div className="flex items-end sm:items-center justify-between sm:justify-end gap-4">
                  <span className="text-xs text-white">Custo <span className="font-mono font-medium text-white">{estimatedTier.buy.toFixed(2)} €</span></span>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-white">{estimatedTier.error ? "Indisponível" : `${estimatedTier.sell.toFixed(2)} €`}</span>
                </div>
              </div>

              {/* Cliente & Serviço */}
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
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
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Serviço / produto *</label>
                    <div role="radiogroup" aria-label="Selecionar serviço" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {availableServicos.map((service) => {
                        const selected = activeLinkeService?.id === service.id
                        return (
                          <label
                            key={service.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${availableServicos.length === 1 ? "sm:col-span-2 xl:col-span-3" : ""} ${selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/50"}`}
                          >
                            <input
                              type="radio"
                              name="service_type"
                              value={service.id}
                              checked={selected}
                              onChange={() => setSelectedServiceId(service.id)}
                              required
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                            />
                            <span className="min-w-0">
                              <span className={`block truncate text-sm font-medium ${selected ? "text-white" : "text-[var(--text-primary)]"}`}>{getServiceDisplayLabel(service)}</span>
                              <span className={`mt-0.5 block text-xs ${selected ? "text-white" : "text-[var(--text-secondary)]"}`}>{service.category}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
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
                    <label htmlFor="ops-length-cm" className="text-[11px] font-semibold text-[var(--text-secondary)]">Comp. (cm) *</label>
                    <input
                      id="ops-length-cm"
                      required
                      type="number"
                      name="length_cm"
                      min="0.1"
                      step="any"
                      placeholder="Ex.: 30"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ops-width-cm" className="text-[11px] font-semibold text-[var(--text-secondary)]">Largura (cm) *</label>
                    <input
                      id="ops-width-cm"
                      required
                      type="number"
                      name="width_cm"
                      min="0.1"
                      step="any"
                      placeholder="Ex.: 20"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ops-height-cm" className="text-[11px] font-semibold text-[var(--text-secondary)]">Altura (cm) *</label>
                    <input
                      id="ops-height-cm"
                      required
                      type="number"
                      name="height_cm"
                      min="0.1"
                      step="any"
                      placeholder="Ex.: 10"
                      className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {isCorreos && <p className="text-xs text-[var(--text-secondary)]">As medidas indicadas aplicam-se a cada volume. Para volumes de tamanhos diferentes, crie envios separados.</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Remetente */}
                <div className="rounded-xl border border-[var(--border-subtle)] p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--status-warning)]" />
                      Remetente
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIsEditingSender(!isEditingSender)} 
                        className="text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-2 py-1 rounded-md transition-colors text-[10px] font-bold"
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
                <div className="rounded-xl border border-[var(--border-subtle)] p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--accent)]" />
                      Destinatário
                    </h3>
                    {selectedClientId && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowAgendaDropdown(!showAgendaDropdown)}
                          className="text-[10px] font-semibold text-white flex items-center gap-1 cursor-pointer bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-2 py-0.5 rounded border border-[var(--accent)]"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Agenda{savedRecipients.length > 0 ? ` (${savedRecipients.length})` : ""}
                        </button>

                        {showAgendaDropdown && (
                          <div className="absolute right-0 top-7 z-40 w-72 max-h-56 overflow-y-auto bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-1 text-xs">
                            <div className="p-1.5 border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider flex justify-between items-center">
                              <span>Contactos da Agenda</span>
                              <button
                                type="button"
                                onClick={() => setShowAgendaDropdown(false)}
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            {loadingAgenda && <p role="status" className="p-3 text-[var(--text-secondary)]">A carregar agenda…</p>}
                            {agendaError && <p role="alert" className="p-3 text-[var(--status-critical)]">{agendaError}</p>}
                            {!loadingAgenda && !agendaError && savedRecipients.length === 0 && (
                              <p className="p-3 text-[var(--text-secondary)]">Ainda não existem destinatários nesta agenda.</p>
                            )}
                            {savedRecipients.map((r) => (
                              <div
                                key={r.id}
                                onClick={() => handleSelectRecipient(r)}
                                className="p-2 hover:bg-[var(--surface-muted)] rounded cursor-pointer transition-colors border-b border-[var(--border-subtle)] last:border-0"
                              >
                                <div className="font-semibold text-[var(--text-primary)] text-[11px] truncate">{r.name}</div>
                                <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                                  {r.address}, {r.postal_code} {r.city}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                          disabled={!destinationCountries.length}
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
                          <option value="">{destinationCountries.length ? "Selecione o país" : "Sem destinos configurados"}</option>
                          {destinationCountries.map(country => (
                            <option key={country.code} value={country.code}>{country.name} ({country.code})</option>
                          ))}
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
                        <label htmlFor="recipient-phone" className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Telefone / Telemóvel</label>
                        <input 
                          type="tel" 
                          id="recipient-phone"
                          name="recipient_phone" 
                          aria-describedby={!isCorreos && recipientCountry !== "PT" ? "recipient-contact-help" : undefined}
                          inputMode="tel"
                          placeholder={recipientCountry === "BE" ? "+32 470 123 456" : recipientCountry === "ES" ? "+34 612 345 678" : "Telemóvel com indicativo do país"}
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] font-mono transition-colors shadow-2xs" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="recipient-email" className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Email (Notificação){!isCorreos && recipientCountry !== "PT" && !hasCttRecipientMobilePhone(recipientPhone, recipientCountry) ? " *" : ""}</label>
                        <input 
                          type="email" 
                          id="recipient-email"
                          name="recipient_email" 
                          required={!isCorreos && recipientCountry !== "PT" && !hasCttRecipientMobilePhone(recipientPhone, recipientCountry)}
                          aria-describedby={!isCorreos && recipientCountry !== "PT" ? "recipient-contact-help" : undefined}
                          placeholder="cliente@email.com" 
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-md text-[11px] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)] transition-colors shadow-2xs" 
                        />
                      </div>
                    </div>

                    {!isCorreos && recipientCountry !== "PT" && <p id="recipient-contact-help" className="text-xs text-[var(--text-secondary)]">CTT internacional: indique um e-mail ou telemóvel do destinatário. Um telefone fixo sozinho não é suficiente.</p>}

                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={saveToAgenda}
                          onChange={(e) => setSaveToAgenda(e.target.checked)}
                          className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span>Guardar destinatário na lista de contactos da empresa</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {!isCorreos && recipientCountry !== "PT" && <div className="px-6 pb-6"><CttExportFields /></div>}

            {specialServicesAvailable.length > 0 && (
              <div className="px-6 pb-6 pt-2">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
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
              <div className={`p-4 rounded-xl border transition-all ${emitMoloniGt ? "bg-[#E9EEE8] dark:bg-[#29342B] border-[#AAB9A8] dark:border-[#526B57] shadow-xs" : "bg-[var(--surface-muted)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"}`}>
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
                aria-busy={loading}
                disabled={loading}
                className="shadow-xs text-[11px] h-auto px-5 py-2 font-bold flex items-center gap-2 bg-[var(--accent)] !bg-[#128A47] text-white hover:bg-[var(--accent-hover)] hover:!bg-[#0E6C37] border-none"
              >
                {loading ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />}
                {loading ? "A criar envio…" : "Emitir Envio & Etiqueta"}
              </Button>
            </div>
          </form>
      </div>
    </div>
  )
}
