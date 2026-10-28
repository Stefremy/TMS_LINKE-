"use client"

import { ShipmentOversizeSummary } from "@/components/shipments/ShipmentOversizeSummary"
import { getParcelLimits } from "@/lib/pricing/oversize-surcharge"
import * as React from "react"
import Link from "next/link"
import {
  Building2,
  MapPin,
  Truck,
  Euro,
  Zap,
  Printer,
  Check,
  FileText,
  ChevronDown,
  Plus,
  ArrowLeft,
  AlertCircle,
  Clock,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  BookmarkCheck,
  PauseCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { emitClientGuiaAction } from "@/app/actions/shipments"
import { getServiceDestinationZone } from "@/lib/services/service-destinations"
import { getAuthorizedDestinationCountries, getDestinationServiceOptions, getServiceIslandTransportMode, isDestinationPostalReady, isPortugueseIslandDestination, type IslandTransportMode } from "@/lib/services/shipment-service-options"
import { getClientSpecialFees, isCorreosLinkeService } from "@/lib/pricing/calculate-shipment-quote"
import { calculateClientShipmentPreview } from "@/lib/pricing/calculate-client-shipment-preview"
import { assertShipmentDestinationAvailable } from "@/lib/services/shipment-destination-policy"
import { focusCttCustomsFields } from "@/lib/ctt-customs-form"
import { readCttExportForm } from "@/lib/services/ctt/export-details"
import { getCttRecipientContactError, hasCttRecipientMobilePhone } from "@/lib/services/ctt/recipient-contact"
import { ShipmentVolumetricSummary } from "@/components/shipments/ShipmentVolumetricSummary"
import { CttExportFields } from "@/components/shipments/CttExportFields"
import { convertZplToPdfAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import {
  SYSTEM_AVAILABLE_WEBSERVICES,
  ClientSpecialServiceFee
} from "@/app/ops/entidades/clientes/types"
import { getClientServiceLabel, getClientServiceName } from "@/lib/services/client-service-label"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { useClientScope } from "./ClientScope"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"
import { PostalAddressSuggestions } from "@/components/postal-address-suggestions"
import { useRecipientAgenda } from "@/lib/hooks/useRecipientAgenda"
import { ClientTopUpModal } from "./ClientTopUpModal"

export function ClientCreateGuia() {
  const { client: currentClient, basePath, isSuspended } = useClientScope()
  const [servicosLinke, setServicosLinke] = React.useState<ServicoLinke[]>([])
  const [loadingClient, setLoadingClient] = React.useState(true)

  // Form states for Guia
  const [recipientName, setRecipientName] = React.useState("")
  const [recipientAddress, setRecipientAddress] = React.useState("")
  const [recipientCity, setRecipientCity] = React.useState("")
  const [recipientPostal, setRecipientPostal] = React.useState("")
  const [recipientPhone, setRecipientPhone] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [weight, setWeight] = React.useState("1.50")

  // Agenda de Destinatários states
  const [saveToAgenda, setSaveToAgenda] = React.useState(false)
  const [showAgendaDropdown, setShowAgendaDropdown] = React.useState(false)
  const { recipients: savedRecipients, loading: loadingAgenda, error: agendaError } =
    useRecipientAgenda(currentClient.id, showAgendaDropdown)

  const handleSelectRecipient = (r: any) => {
    const country = (r.country || "PT").trim().toUpperCase()
    if (!destinationCountries.some(option => option.code === country)) {
      setSubmitError("O país deste destinatário não tem serviços autorizados disponíveis para este cliente.")
      setShowAgendaDropdown(false)
      return
    }
    setRecipientName(r.name || "")
    setRecipientAddress(r.address || "")
    setRecipientPostal(r.postal_code || "")
    setRecipientCity(r.city || "")
    setRecipientCountry(country)
    setRecipientPhone(r.phone || "")
    setRecipientEmail(r.email || "")
    setShowAgendaDropdown(false)
  }
  const [selectedCarrierCode, setSelectedCarrierCode] = React.useState<string>("ctt_expresso")
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>("")
  const [islandTransportChoice, setIslandTransportChoice] = React.useState<IslandTransportMode | "">("")
  const [parcelWeights, setParcelWeights] = React.useState<string[]>([])
  const [volumesCount, setVolumesCount] = React.useState("1")
  const [lengthCm, setLengthCm] = React.useState("")
  const [widthCm, setWidthCm] = React.useState("")
  const [heightCm, setHeightCm] = React.useState("")
  const [observations, setObservations] = React.useState("")

  // Sender states
  const [isEditingSender, setIsEditingSender] = React.useState(false)
  const [customSenderName, setCustomSenderName] = React.useState("")
  const [customSenderAddress, setCustomSenderAddress] = React.useState("")
  const [customSenderCity, setCustomSenderCity] = React.useState("")
  const [customSenderPostal, setCustomSenderPostal] = React.useState("")

  // Special Services selections
  const [selectedSpecialServices, setSelectedSpecialServices] = React.useState<string[]>([])
  const [codAmount, setCodAmount] = React.useState("50.00")

  // Postal code lookup
  const [recipientCountry, setRecipientCountry] = React.useState("PT")

  const postalLookup = usePostalCodeLookup({
    country: recipientCountry,
    onFound: (info) => {
      setRecipientCity(info.city)
      if (!recipientAddress && info.street) {
        setRecipientAddress(`${info.street}, nº `)
      }
    }
  })

  // Generation feedback & session history
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const submissionRef = React.useRef(false)
  const pageTopRef = React.useRef<HTMLDivElement>(null)
  const [generatedGuia, setGeneratedGuia] = React.useState<string | null>(null)
  const [generatedLabelBase64, setGeneratedLabelBase64] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [dbWarning, setDbWarning] = React.useState<string | null>(null)
  const [fieldError, setFieldError] = React.useState<"postal" | "name" | "address" | "weight" | "special" | null>(null)
  const [isTopUpOpen, setIsTopUpOpen] = React.useState(false)
  const [sessionShipments, setSessionShipments] = React.useState<Array<{
    guia: string
    destinatario: string
    transportadora: string
    servico: string
    estado: string
    data: string
    valor: string
    numericValue: number
  }>>([])

  React.useEffect(() => {
    if (!generatedGuia) return
    pageTopRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    })
  }, [generatedGuia])

  React.useEffect(() => {
    let active = true
    getServicosLinkeAction().then(servicos => {
      if (!active) return
      setServicosLinke(servicos || [])
      const allowed = (currentClient.allowed_webservices || SYSTEM_AVAILABLE_WEBSERVICES).filter(w => w.is_enabled)
      const defWs = allowed.find(w => w.is_default) || allowed[0]
      if (defWs) setSelectedCarrierCode(defWs.code)
      // Destination coverage determines the selection after country/postal entry.

      // Initialize custom sender with client data
      setCustomSenderName(currentClient.legal_name || currentClient.short_name || "")
      setCustomSenderAddress(currentClient.address || "")
      setCustomSenderCity(currentClient.city || "")
      setCustomSenderPostal(currentClient.postal_code || "")

      setLoadingClient(false)
    }).catch(() => { if (active) setLoadingClient(false) })
    return () => { active = false }
  }, [currentClient.id, currentClient.allowed_webservices, currentClient.default_linke_table_id])

  // Available Linke services
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

  const destinationCountries = React.useMemo(() => getAuthorizedDestinationCountries(availableServicos), [availableServicos])
  React.useEffect(() => {
    if (loadingClient || !recipientCountry || destinationCountries.some(country => country.code === recipientCountry)) return
    setRecipientCountry("")
    setRecipientPostal("")
    setRecipientCity("")
    postalLookup.reset()
  }, [loadingClient, recipientCountry, destinationCountries, postalLookup.reset])
  const destinationReady = isDestinationPostalReady(recipientCountry, recipientPostal)
  const isIslandDestination = isPortugueseIslandDestination(recipientCountry, recipientPostal)
  const destinationServices = React.useMemo(() => getDestinationServiceOptions(availableServicos, recipientCountry, recipientPostal), [availableServicos, recipientCountry, recipientPostal])
  const islandModes = React.useMemo(() => isIslandDestination
    ? [...new Set(destinationServices.map(getServiceIslandTransportMode))] : [], [destinationServices, isIslandDestination])
  const selectedIslandMode = isIslandDestination
    ? islandModes.includes(islandTransportChoice as IslandTransportMode) ? islandTransportChoice as IslandTransportMode
      : islandModes.length === 1 ? islandModes[0] : undefined
    : undefined
  const compatibleServices = React.useMemo(() => isIslandDestination && !selectedIslandMode ? []
    : getDestinationServiceOptions(availableServicos, recipientCountry, recipientPostal, selectedIslandMode),
    [availableServicos, recipientCountry, recipientPostal, isIslandDestination, selectedIslandMode])
  const activeLinkeService = compatibleServices.find(service => service.id === selectedServiceId)
    || (compatibleServices.length === 1 ? compatibleServices[0] : undefined)

  React.useEffect(() => {
    if (!isIslandDestination) setIslandTransportChoice("")
    else if (islandTransportChoice && !islandModes.includes(islandTransportChoice)) setIslandTransportChoice("")
  }, [isIslandDestination, islandTransportChoice, islandModes])
  React.useEffect(() => {
    if (compatibleServices.some(service => service.id === selectedServiceId)) return
    setSelectedServiceId(compatibleServices.length === 1 ? compatibleServices[0].id : "")
  }, [compatibleServices, selectedServiceId])
  const parcelWeightsKg = React.useMemo(() => {
    const count = Number(volumesCount)
    const limit = getParcelLimits(activeLinkeService ?? {}, recipientCountry)?.maxWeightKg ?? Infinity
    if (!Number.isSafeInteger(count) || count <= 1 || count > 1000 || Number(weight) <= limit || !parcelWeights.some(Boolean)) return undefined
    return Array.from({ length: count }, (_, i) => Number(parcelWeights[i] ?? ""))
  }, [activeLinkeService, recipientCountry, weight, volumesCount, parcelWeights])
  // Available special services fees
  const specialFeesList: ClientSpecialServiceFee[] = React.useMemo(() => {
    return getClientSpecialFees(currentClient)
  }, [currentClient])

  const isCorreosService = Boolean(
    activeLinkeService?.carrier_group === "correos" ||
    activeLinkeService?.preferred_carrier_name?.toLowerCase().includes("correos") ||
    activeLinkeService?.code?.startsWith("LK-COR") ||
    activeLinkeService?.webservice_connection_id === "correos_express" ||
    (typeof isCorreosLinkeService === "function" && isCorreosLinkeService(activeLinkeService))
  )
  const requiresCttContact = !isCorreosService && recipientCountry !== "PT"
  const requiresRecipientEmail = requiresCttContact && !hasCttRecipientMobilePhone(recipientPhone, recipientCountry)
  const activeSpecialServices = React.useMemo(() => selectedSpecialServices.filter(code =>
    specialFeesList.some(f => f.is_enabled && f.special_service_code === code &&
      code.startsWith("correos_") === isCorreosService)), [selectedSpecialServices, specialFeesList, isCorreosService])

  // Compute live simulated price using exact Linke Table tiers & client special services
  const calculatedPrice = React.useMemo(() => {
    const destinationZone = activeLinkeService ? getServiceDestinationZone(activeLinkeService, recipientCountry, recipientPostal) : ""
    try {
      if (!destinationCountries.length) throw new Error("Este cliente não tem países de destino com tarifas configuradas.")
      if (!destinationReady) throw new Error("Preencha o país e um código postal completo para ver as opções de envio.")
      assertShipmentDestinationAvailable(recipientCountry, recipientPostal)
      if (isIslandDestination && islandModes.length > 1 && !selectedIslandMode) throw new Error("Escolha como pretende enviar para as ilhas: aéreo, marítimo ou outra opção disponível.")
      if (!destinationServices.length) throw new Error("Não existem serviços autorizados com cobertura e tarifas para este destino. Contacte o apoio Linke.")
      if (!activeLinkeService) throw new Error("Selecione uma das opções de envio disponíveis.")
      if (!destinationCountries.length) throw new Error("Este serviço não tem países de destino com tarifas configuradas.")
      if (!destinationCountries.some(country => country.code === recipientCountry)) throw new Error("Selecione um país disponível para este serviço.")
      assertShipmentDestinationAvailable(recipientCountry, recipientPostal)
      const quote = calculateClientShipmentPreview(Number(weight), currentClient, activeLinkeService,
        recipientCountry, recipientPostal, activeSpecialServices, Number(codAmount),
        [lengthCm, widthCm, heightCm].every(value => Number(value) >= 0.1) ? { lengthCm: Number(lengthCm), widthCm: Number(widthCm), heightCm: Number(heightCm), volumesCount: Number(volumesCount), parcelWeightsKg } : undefined)
      return {
        base: quote.basePrice.toFixed(2), fuel: quote.fuelSurchargeAmount.toFixed(2),
        fuelPct: activeLinkeService.fuel_surcharge_pct ?? currentClient.pricing?.fuel_surcharge_pct ?? 12.5,
        specialTotal: quote.specialFeesAmount.toFixed(2), specialItems: quote.specialItems,
        total: quote.totalPrice.toFixed(2), billableWeightKg: quote.billableWeightKg, volumetricWeightKg: quote.volumetricWeightKg, volumetricDivisor: quote.volumetricDivisor, destinationZone, isBlocked: false, blockedReason: null,
      }
    } catch (error) {
      return {
        base: "0.00", fuel: "0.00", fuelPct: 0, specialTotal: "0.00", specialItems: [], total: "0.00",
        destinationZone, billableWeightKg: null, volumetricWeightKg: null, volumetricDivisor: null, isBlocked: true,
        blockedReason: error instanceof Error ? error.message : "Não foi possível calcular a tarifa.",
      }
    }
  }, [currentClient, activeLinkeService, destinationCountries, weight, recipientCountry, recipientPostal, activeSpecialServices, codAmount, lengthCm, widthCm, heightCm, volumesCount, parcelWeightsKg, destinationReady, isIslandDestination, islandModes, selectedIslandMode, destinationServices])

  const handleCreateShipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submittedForm = e.currentTarget
    if (isSuspended) {
      setSubmitError("A sua conta encontra-se suspensa para a criação de novos envios. Contacte geral@linke.pt para reativar.")
      return
    }
    if (submissionRef.current) return
    if (!recipientName) {
      alert("Por favor indique o nome do destinatário.")
      return
    }

    if (calculatedPrice.isBlocked) {
      setSubmitError(calculatedPrice.blockedReason || "Este serviço não permite envios para o destino selecionado.")
      return
    }

    const numericVal = parseFloat(calculatedPrice.total) || 0
    const chosenService = activeLinkeService?.name || "Linke Expresso 24H"

    submissionRef.current = true
    setIsSubmitting(true)

    // Clear previous errors
    setSubmitError(null)
    setFieldError(null)

    try {
      if (requiresCttContact) {
        const contactError = getCttRecipientContactError({ country: recipientCountry, phone: recipientPhone, email: recipientEmail })
        if (contactError) throw new Error(contactError)
      }
      const res = await emitClientGuiaAction({
        clientId: currentClient?.id,
        clientName: isEditingSender ? customSenderName : (currentClient?.short_name || currentClient?.legal_name),
        senderAddress: isEditingSender ? customSenderAddress : (currentClient?.address || "Sede Comercial"),
        senderCity: isEditingSender ? customSenderCity : (currentClient?.city || "Portugal"),
        senderPostal: isEditingSender ? customSenderPostal : (currentClient?.postal_code || ""),
        senderPhone: currentClient?.phone || currentClient?.mobile_phone || "910000000",
        recipientName,
        recipientAddress,
        recipientCity,
        recipientPostal,
        recipientCountry,
        recipientPhone,
        recipientEmail,
        weightKg: parseFloat(weight) || 1.0,
        volumesCount: parseInt(volumesCount) || 1,
        islandTransportMode: selectedIslandMode,
        lengthCm: Number(lengthCm),
        widthCm: Number(widthCm),
        heightCm: Number(heightCm),
        parcelWeightsKg,
        serviceId: activeLinkeService?.id,
        serviceName: chosenService,
        subProductId: activeLinkeService?.webservice_service_code,
        webserviceConnectionId: activeLinkeService?.webservice_connection_id,
        calculatedPrice: numericVal,
        codValue: parseFloat(codAmount) || 0,
        selectedSpecialServices: activeSpecialServices,
        observations,
        cttExportDetails: !isCorreosService && recipientCountry !== "PT" ? readCttExportForm(new FormData(e.currentTarget), { country: recipientCountry, postalCode: recipientPostal, weightKg: Number(weight) }) : undefined,
      })

      if (!res.success) throw new Error(res.error || "Não foi possível criar o envio.")
      const confirmedPrice = res.sellPrice
      if (typeof confirmedPrice !== "number") throw new Error("Não foi possível obter o preço final do envio.")
      const newCode = res.guia || ""

      const newShipment = {
        guia: newCode,
        destinatario: `${recipientName}${recipientCity ? `, ${recipientCity}` : ""}`,
        transportadora: chosenService.toLowerCase().includes("correos") ? "Correos Express" : "CTT Expresso",
        servico: chosenService,
        estado: "pendente",
        data: new Date().toLocaleDateString("pt-PT"),
        valor: `${confirmedPrice.toFixed(2)}€`,
        numericValue: confirmedPrice,
      }

      setSessionShipments((prev) => [newShipment, ...prev])
      setGeneratedGuia(newCode)
      setGeneratedLabelBase64(res.labelBase64 || null)
      setDbWarning((res as any).dbWarning || null)

      // Auto-download da etiqueta assim que o envio é criado
      if (res.labelBase64) {
        const label = res.labelBase64
        const fname = `${newCode || "Envio"}_Etiqueta.pdf`
        if (label.trimStart().startsWith("^XA")) {
          convertZplToPdfAction(label).then((conv) => {
            if (conv.success && conv.base64) {
              downloadCttLabel(conv.base64, fname)
            }
          })
        } else {
          // Timeout ligeiro para garantir que o modal já montou no DOM
          setTimeout(() => {
            downloadCttLabel(label, fname)
          }, 150)
        }
      }

      if (saveToAgenda && recipientName && recipientAddress && recipientPostal) {
        import("@/app/actions/destinatarios")
          .then((m) =>
            m.saveDestinatarioAction({
              name: recipientName,
              address: recipientAddress,
              postal_code: recipientPostal,
              city: recipientCity,
              country: recipientCountry,
              phone: recipientPhone,
              email: recipientEmail,
              client_id: currentClient?.id,
            })
          )
          .catch(() => {})
      }

      setRecipientName("")
      setRecipientAddress("")
      setRecipientCity("")
      setRecipientPostal("")
      setRecipientPhone("")
      setRecipientEmail("")
      setVolumesCount("1")
      setParcelWeights([])
    } catch (err: any) {
      const msg: string = err?.message || "Erro desconhecido."
      setSubmitError(msg)
      focusCttCustomsFields(submittedForm, msg)
      // Highlight the likely offending field
      if (msg.toLowerCase().includes("postal") || msg.toLowerCase().includes("código postal")) {
        setFieldError("postal")
        document.getElementById("field-recipient-postal")?.focus()
      } else if (msg.toLowerCase().includes("nome") || msg.toLowerCase().includes("name")) {
        setFieldError("name")
        document.getElementById("field-recipient-name")?.focus()
      } else if (msg.toLowerCase().includes("morada") || msg.toLowerCase().includes("address")) {
        setFieldError("address")
        document.getElementById("field-recipient-address")?.focus()
      } else if (msg.toLowerCase().includes("peso") || msg.toLowerCase().includes("weight")) {
        setFieldError("weight")
      } else if (msg.toLowerCase().includes("serviço especial") || msg.toLowerCase().includes("subproduto")) {
        setFieldError("special")
      }
    } finally {
      submissionRef.current = false
      setIsSubmitting(false)
    }
  }


  const defaultSenderName = currentClient?.legal_name || currentClient?.short_name || "Empresa Cliente"
  const defaultSenderAddressStr = currentClient?.address
    ? `${currentClient.address}, ${currentClient.postal_code || ""} ${currentClient.city || ""}`.trim()
    : "Sede Comercial da Empresa"

  return (
    <div ref={pageTopRef} className="flex flex-col gap-6 max-w-6xl mx-auto scroll-mt-20">

      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-1">
            <Link href={basePath} className="hover:text-[#2d533d]">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-[#38664b] font-bold">Novo Envio</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Criar Novo Envio</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Emissão direta com transportadoras parceiras, serviços suplementares e preçário personalizado da sua conta.
          </p>
        </div>

        {currentClient && (
          <div className="flex items-center gap-2.5 bg-white border border-zinc-200 px-4 py-2 rounded-2xl shadow-2xs text-xs">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs shrink-0 overflow-hidden border border-zinc-200"
              style={{ backgroundColor: currentClient.color || "#10b981" }}
            >
              {currentClient.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentClient.logo_url} alt={currentClient.short_name} className="w-full h-full object-cover bg-white" />
              ) : (
                <span>{currentClient.short_name ? currentClient.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-4 h-4" />}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-zinc-900">{currentClient.short_name}</div>
              <div className="text-[10px] text-zinc-400 font-mono">Conta: {currentClient.code}</div>
            </div>
          </div>
        )}
      </div>

      {/* Success notification banner */}
      {generatedGuia && (
        <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] border-l-4 border-l-emerald-600 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-md bg-[#2f6b4a] text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Guia Emitida com Sucesso!</span>
                  <span className="font-mono text-xs bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-2 py-0.5 rounded-md font-semibold">
                    {generatedGuia}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  O envio foi registado com o serviço <strong>{activeLinkeService?.name || "Linke Expresso 24H"}</strong>.
                </p>
              </div>
            </div>
            {dbWarning && (
              <div className="mt-2 p-3 bg-[var(--status-warning-soft)] text-[var(--status-warning)] text-xs font-medium rounded-md border border-[var(--status-warning)]">
                <strong>Envio aceite — gravação a verificar:</strong> {dbWarning} Não volte a criar este envio. Confirme o registo no histórico ou contacte o suporte.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={basePath}
              className="bg-[var(--text-primary)] hover:opacity-90 text-white px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Ver no Painel</span>
            </Link>
            <Link
              href={`${basePath}/envios`}
              className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors"
            >
              <span>Ver no Histórico</span>
            </Link>
            {generatedLabelBase64 ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    let label = generatedLabelBase64
                    // Se for ZPL cru, converter server-side antes de imprimir
                    if (label?.trimStart().startsWith("^XA")) {
                      const res = await convertZplToPdfAction(label)
                      if (!res.success || !res.base64) {
                        alert(`Falha ao converter etiqueta ZPL para PDF: ${res.error || "Erro desconhecido"}`)
                        return
                      }
                      label = res.base64
                    }
                    printCttLabel(label)
                  }}
                  className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    let label = generatedLabelBase64
                    const fname = `${generatedGuia || "Envio"}_Etiqueta.pdf`
                    // Se for ZPL cru, converter server-side antes de descarregar
                    if (label?.trimStart().startsWith("^XA")) {
                      const res = await convertZplToPdfAction(label)
                      if (!res.success || !res.base64) {
                        alert(`Falha ao converter etiqueta ZPL para PDF: ${res.error || "Erro desconhecido"}`)
                        return
                      }
                      label = res.base64
                    }
                    const ok = downloadCttLabel(label, fname)
                    if (!ok) alert('Não foi possível descarregar a etiqueta. Verifique a consola do browser.')
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descarregar Etiqueta CTT</span>
                  <span className="sm:hidden">Etiqueta CTT</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-semibold">
                Envio criado. A etiqueta oficial não está disponível. Consulte o envio {generatedGuia} no portal {isCorreosService ? "Correos Express" : "CTT"} ou contacte o apoio para obter a etiqueta.
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setGeneratedGuia(null)
                setGeneratedLabelBase64(null)
              }}
              className="text-[#2d533d] hover:text-emerald-950 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Card Form */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 p-4 sm:p-6 md:p-8">
        <form onSubmit={handleCreateShipment} aria-busy={isSubmitting} className="space-y-6">
          {isSuspended && (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-700 shrink-0" />
                <h3 className="text-sm font-bold">Conta Suspensa para Criação de Novos Envios</h3>
              </div>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                A sua conta está temporariamente suspensa para emitir novas guias. Pode consultar os seus envios anteriores, faturas e conta-corrente. Para desbloquear a emissão, contacte geral@linke.pt.
              </p>
            </div>
          )}

            {/* Remetente Card */}
            <div className="space-y-3 bg-[#f3f8f4] p-4 rounded-2xl border border-[#d8e6db]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-700">Remetente (A sua Empresa)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingSender(!isEditingSender)}
                    className="text-[10px] font-bold text-[#38664b] hover:text-[#2d533d] bg-stone-50 hover:bg-stone-100 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {isEditingSender ? "Cancelar" : "Editar"}
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)] font-semibold border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">Conta Ativa</span>
                </div>
              </div>

              {!isEditingSender ? (
                <div>
                  <div className="text-xs text-zinc-900 font-bold">{customSenderName || defaultSenderName}</div>
                  <div className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">
                    {customSenderAddress || currentClient?.address
                      ? `${customSenderAddress || currentClient?.address}, ${customSenderPostal || currentClient?.postal_code || ""} ${customSenderCity || currentClient?.city || ""}`.trim()
                      : defaultSenderAddressStr}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-zinc-500">Nome</label>
                    <input
                      type="text"
                      value={customSenderName}
                      onChange={e => setCustomSenderName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase text-zinc-500">Morada</label>
                    <input
                      type="text"
                      value={customSenderAddress}
                      onChange={e => setCustomSenderAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-zinc-500">C. Postal</label>
                      <input
                        type="text"
                        value={customSenderPostal}
                        onChange={e => setCustomSenderPostal(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-zinc-500">Localidade</label>
                      <input
                        type="text"
                        value={customSenderCity}
                        onChange={e => setCustomSenderCity(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4" aria-label="Destino do envio">
            <h2 className="text-xs font-bold text-zinc-900">1. Para onde vai o envio?</h2>
            {/* Destinatário */}
            <div className="min-w-0">
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-700">Nome do Destinatário *</label>
                  {currentClient.id && (
                    <button
                      type="button"
                      onClick={() => setShowAgendaDropdown(!showAgendaDropdown)}
                      className="text-[11px] font-semibold text-[#38664b] hover:text-[#2d533d] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      Agenda{savedRecipients.length > 0 ? ` (${savedRecipients.length})` : ""}
                    </button>
                  )}
                </div>

                {showAgendaDropdown && (
                  <div className="absolute z-30 left-0 top-16 w-full max-h-56 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-xl p-1 text-xs">
                    <div className="p-2 border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Contactos da Agenda</span>
                      <button
                        type="button"
                        onClick={() => setShowAgendaDropdown(false)}
                        className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {loadingAgenda && <p role="status" className="p-3 text-zinc-500">A carregar agenda…</p>}
                    {agendaError && <p role="alert" className="p-3 text-red-700">{agendaError}</p>}
                    {!loadingAgenda && !agendaError && savedRecipients.length === 0 && (
                      <p className="p-3 text-zinc-500">Ainda não existem destinatários nesta agenda.</p>
                    )}
                    {savedRecipients.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRecipient(r)}
                        className="p-2 hover:bg-stone-50/60 rounded-lg cursor-pointer transition-colors border-b border-zinc-50 last:border-0"
                      >
                        <div className="font-semibold text-zinc-800">{r.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          {r.address}, {r.postal_code} {r.city}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  id="field-recipient-name"
                  type="text"
                  required
                  placeholder="Ex: Comercial Lisboa Lda ou Maria Fernandes"
                  value={recipientName}
                  onChange={(e) => { setRecipientName(e.target.value); if (fieldError === "name") setFieldError(null) }}
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 font-medium ${
                    fieldError === "name"
                      ? "border-red-400 ring-1 ring-red-400 bg-red-50 focus:ring-red-400"
                      : "border-zinc-300 focus:ring-[#718774]/25 focus:border-[#718774]"
                  }`}
                />
              </div>

            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700">País de Destino *</label>
                <select
                  name="recipient_country"
                  value={recipientCountry}
                  required
                  disabled={!destinationCountries.length}
                  onChange={(e) => {
                    const c = e.target.value
                    setRecipientCountry(c)
                    setRecipientPostal("")
                    setRecipientCity("")
                    postalLookup.reset()
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774] cursor-pointer shadow-2xs"
                >
                  <option value="">{destinationCountries.length ? "Selecione o país" : "Sem destinos configurados"}</option>
                  {destinationCountries.map(country => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-700">Código Postal *</label>
                {postalLookup.loading && (
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> A validar...
                  </span>
                )}
                {postalLookup.status === "valid" && (
                  <span className="text-[10px] text-[#38664b] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {postalLookup.info?.city || "Escolha a localidade"}
                  </span>
                )}
                {postalLookup.status === "invalid" && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    Sem sugestão — preencha manualmente
                  </span>
                )}
              </div>
              <input
                id="field-recipient-postal"
                type="text"
                placeholder={recipientCountry === "ES" ? "28001" : recipientCountry === "PT" ? "4000-001" : "Código postal"}
                value={recipientPostal}
                onChange={(e) => {
                  const formatted = postalLookup.lookup(e.target.value, recipientCountry)
                  setRecipientPostal(formatted)
                  if (fieldError === "postal") setFieldError(null)
                }}
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 ${
                  fieldError === "postal"
                    ? "border-red-400 ring-1 ring-red-400 bg-red-50 focus:ring-red-400"
                    : "border-zinc-300 focus:ring-[#718774]/25 focus:border-[#718774]"
                }`}
              />
            </div>
            </div>
            {destinationReady && <p role="status" className="text-xs text-zinc-600">{recipientCountry === "PT" ? isIslandDestination ? "Destino: Açores ou Madeira" : "Destino: Portugal Continental" : recipientCountry === "ES" ? recipientPostal.startsWith("07") ? "Destino: Baleares" : "Destino: Espanha" : "Destino internacional"}</p>}
          </section>

          {/* Cidade e morada de entrega */}
          <div className="grid grid-cols-1 gap-4">


            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700">Localidade / Cidade *</label>
              <input
                type="text"
                placeholder="Ex: Porto"
                value={recipientCity}
                onChange={(e) => setRecipientCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700">Morada de Entrega *</label>
            <div className="relative">
              <input
                id="field-recipient-address"
                type="text"
                required
                placeholder="Rua, avenida, número, andar, porta..."
                value={recipientAddress}
                onChange={(e) => { setRecipientAddress(e.target.value); if (fieldError === "address") setFieldError(null) }}
                className={`w-full pl-3.5 pr-8 py-2.5 bg-white border rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ${
                  fieldError === "address"
                    ? "border-red-400 ring-1 ring-red-400 bg-red-50 focus:ring-red-400"
                    : "border-zinc-300 focus:ring-[#718774]/25 focus:border-[#718774]"
                }`}
              />
              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            <PostalAddressSuggestions info={postalLookup.info} onCity={setRecipientCity} onStreet={street => setRecipientAddress(`${street}, nº `)} />
          </div>

          {!isCorreosService && recipientCountry !== "PT" && <CttExportFields country={recipientCountry} postalCode={recipientPostal} key={`${recipientCountry}-${generatedGuia || "new"}`} />}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="recipient-phone" className="block text-xs font-bold text-zinc-700">Telefone / Telemóvel do Destinatário</label>
              <input
                type="tel"
                id="recipient-phone"
                name="recipient_phone"
                aria-describedby={requiresCttContact ? "recipient-contact-help" : undefined}
                inputMode="tel"
                placeholder={recipientCountry === "BE" ? "Ex: +32 470 123 456" : recipientCountry === "ES" ? "Ex: +34 612 345 678" : "Telemóvel com indicativo do país"}
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="recipient-email" className="block text-xs font-bold text-zinc-700">Email do Destinatário{requiresRecipientEmail ? " *" : ""}</label>
              <input
                type="email"
                id="recipient-email"
                name="recipient_email"
                required={requiresRecipientEmail}
                aria-describedby={requiresCttContact ? "recipient-contact-help" : undefined}
                placeholder="email@exemplo.pt"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
              {requiresCttContact && <p id="recipient-contact-help" className="text-xs text-zinc-600">CTT internacional: indique um e-mail ou telemóvel do destinatário. Um telefone fixo sozinho não é suficiente.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700">Nº de Volumes *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={volumesCount}
                onChange={(e) => setVolumesCount(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>
          </div>


          {/* Checkbox para guardar destinatário na agenda */}
          <div className="flex items-center gap-2 pt-1 pb-2">
            <input
              type="checkbox"
              id="save_to_agenda"
              checked={saveToAgenda}
              onChange={(e) => setSaveToAgenda(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-[#38664b] focus:ring-[#718774]/25 focus:border-[#718774] cursor-pointer"
            />
            <label htmlFor="save_to_agenda" className="text-xs text-zinc-600 cursor-pointer select-none">
              Guardar este destinatário na lista de contactos da empresa para envios futuros
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="field-length-cm" className="block text-xs font-bold text-zinc-700">Comp. (cm) *</label>
              <input
                id="field-length-cm"
                name="length_cm"
                required
                type="number"
                min="0.1"
                step="any"
                placeholder="Ex: 10"
                value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="field-width-cm" className="block text-xs font-bold text-zinc-700">Largura (cm) *</label>
              <input
                id="field-width-cm"
                name="width_cm"
                required
                type="number"
                min="0.1"
                step="any"
                placeholder="Ex: 10"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="field-height-cm" className="block text-xs font-bold text-zinc-700">Altura (cm) *</label>
              <input
                id="field-height-cm"
                name="height_cm"
                required
                type="number"
                min="0.1"
                step="any"
                placeholder="Ex: 10"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700">Peso Total (kg) *</label>
              <input
                name="weight_kg"
                type="number"
                step="0.1"
                min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
              />
            </div>
          </div>

          <ShipmentOversizeSummary service={activeLinkeService} country={recipientCountry} weightKg={Number(weight)}
            lengthCm={Number(lengthCm)} widthCm={Number(widthCm)} heightCm={Number(heightCm)} volumesCount={Number(volumesCount)}
            parcelWeightsKg={parcelWeightsKg} weights={parcelWeights} onWeightsChange={setParcelWeights} />
          <ShipmentVolumetricSummary service={activeLinkeService} country={recipientCountry} postal={recipientPostal}
            weightKg={Number(weight)} lengthCm={Number(lengthCm)} widthCm={Number(widthCm)} heightCm={Number(heightCm)} volumesCount={Number(volumesCount)} />

          {(isCorreosService || Number(volumesCount) > 1) && <p className="text-xs text-zinc-600">As medidas indicadas aplicam-se a cada volume. Para volumes de tamanhos diferentes, crie envios separados.</p>}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700">Observações (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Entregar até às 18h..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774]"
            />
            <p className="text-[10px] text-zinc-400">
              Máximo de 40 caracteres suportados pela transportadora.
            </p>
          </div>

          {/* SERVIÇOS ESPECIAIS E SUPLEMENTARES */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <label className="block text-xs font-bold text-zinc-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-zinc-500" />
                <span>Serviços Especiais & Suplementares {isCorreosService ? "Correos Express" : "CTT"} (SpecialServices)</span>
              </label>
              <span className="text-[11px] text-zinc-400">Opcionais por envio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {specialFeesList
                .filter(f => f.is_enabled)
                .filter(f => (activeLinkeService?.preferred_carrier_name || activeLinkeService?.name || "").toLowerCase().includes("correos") ? f.special_service_code.startsWith("correos_") : !f.special_service_code.startsWith("correos_"))
                .map(fee => {
                const isSelected = selectedSpecialServices.includes(fee.special_service_code)
                return (
                  <div key={fee.special_service_code} className={`p-3 rounded-xl border transition-colors ${isSelected ? "bg-stone-50/50 border-[#a4b0a5]" : "bg-zinc-50 border-zinc-200"}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`opt_${fee.special_service_code}`}
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSpecialServices(prev => [...prev, fee.special_service_code])
                          } else {
                            setSelectedSpecialServices(prev => prev.filter(c => c !== fee.special_service_code))
                          }
                        }}
                        className="w-4 h-4 rounded text-[#38664b] focus:ring-[#718774]/25 focus:border-[#718774] cursor-pointer"
                      />
                      <label htmlFor={`opt_${fee.special_service_code}`} className="font-bold text-zinc-800 cursor-pointer text-xs">
                        {fee.special_service_name}
                      </label>
                    </div>
                    {(fee.special_service_code === "cod" || fee.special_service_code === "correos_cod") && isSelected && (
                      <div className="mt-2 pl-6 flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-500">Valor (€):</span>
                        <input
                          type="number"
                          step="0.01"
                          value={codAmount}
                          onChange={(e) => setCodAmount(e.target.value)}
                          className="w-24 border border-zinc-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold bg-white"
                        />
                      </div>
                    )}
                    {fee.special_service_code !== "cod" && (
                      <p className="text-[10px] text-zinc-400 pl-6 mt-1 line-clamp-2" title={fee.description}>
                        {fee.fee_type === "fixed" ? `+${fee.fixed_value?.toFixed(2)}€` : `+${fee.percentage_value}% (mín. ${fee.min_value?.toFixed(2)}€)`} {fee.description ? `- ${fee.description}` : ""}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* SELEÇÃO DO SERVIÇO LINKE */}
          <div className="bg-[#f3f8f4] p-5 rounded-2xl border border-[#d8e6db] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-900 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-white border border-zinc-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCarrierLogo(activeLinkeService?.preferred_carrier_name || "ctt") || ""}
                    alt="Transportadora"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <span>2. Serviço de Transporte Linke</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-secondary)] font-semibold border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
                  {activeLinkeService?.category || "Opções de envio"}
                </span>
              </div>
            </div>

            {isIslandDestination && islandModes.length > 0 && <fieldset className="rounded-xl border border-[#d8e6db] bg-white p-3">
              <legend className="px-1 text-xs font-semibold text-zinc-800">Como pretende enviar para as ilhas?</legend>
              <div className="flex flex-wrap gap-3">{islandModes.map(mode => <label key={mode}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${selectedIslandMode === mode ? "border-[#718774] bg-[#f3f8f4] text-[#3e5845]" : "border-zinc-200 text-zinc-700"}`}>
                <input type="radio" name="island_transport_mode" value={mode} checked={selectedIslandMode === mode}
                  onChange={() => setIslandTransportChoice(mode)} className="accent-[#38664b]" />
                {mode === "air" ? "Aéreo (avião)" : mode === "sea" ? "Marítimo (barco)" : "Outros serviços"}
              </label>)}</div>
              {islandModes.length === 1 && <p className="mt-2 text-[11px] text-zinc-500">Esta é a modalidade disponível para o seu destino e conta.</p>}
              <p className="mt-2 text-[11px] text-zinc-500">O prazo para as ilhas depende do percurso. Confirme o prazo da opção escolhida.</p>
            </fieldset>}

            <div className="relative">
              <select
                aria-label="Serviço de Transporte Linke"
                value={activeLinkeService?.id || ""}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                disabled={!compatibleServices.length}
                className="w-full pl-3.5 pr-8 py-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#718774]/25 focus:border-[#718774] cursor-pointer shadow-2xs"
              >
                <option value="">{!destinationReady ? "Preencha o destino primeiro" : isIslandDestination && !selectedIslandMode && islandModes.length > 1 ? "Escolha aéreo ou marítimo" : compatibleServices.length ? "Selecione o serviço" : "Sem serviços para este destino"}</option>
                {compatibleServices.map(service => (
                  <option key={service.id} value={service.id}>{getClientServiceLabel(service)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            <p className="text-[11px] text-zinc-500">As opções apresentadas respeitam o destino e os serviços autorizados na sua conta.</p>

            {destinationReady && calculatedPrice.isBlocked && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#faf6ec] border border-[#ded0af] text-[#725a35] text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#9a7d48] mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Preço indisponível para este envio</div>
                  <div className="text-[11px] text-[#806b49] mt-0.5">{calculatedPrice.blockedReason}</div>
                </div>
              </div>
            )}
          </div>

          {/* SIMULAÇÃO DE PREÇO & BOTÃO DE EMISSÃO */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 rounded-2xl">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#2f6b4a] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Euro className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-zinc-500 font-medium flex items-center gap-2 flex-wrap">
                  <span>Preço Total Estimado do Envio (sem IVA):</span>
                  {(activeLinkeService?.zones?.length || 0) > 1 && calculatedPrice.destinationZone && !calculatedPrice.isBlocked && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200/80 text-zinc-800 border border-zinc-300/80">
                      Tarifa {calculatedPrice.destinationZone}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono">
                    {calculatedPrice.isBlocked ? "Indisponível" : `${calculatedPrice.total}€`}
                  </span>
                  {calculatedPrice.isBlocked ? (
                    <span role="status" className="text-xs text-amber-800">{calculatedPrice.blockedReason}</span>
                  ) : (
                    <span className="text-[10px] sm:text-[11px] text-zinc-500">
                      (Base: <strong>{calculatedPrice.base}€</strong> + Comb. {calculatedPrice.fuelPct}%: <strong>{calculatedPrice.fuel}€</strong>
                      {parseFloat(calculatedPrice.specialTotal) > 0 ? ` + Supl.: ${calculatedPrice.specialTotal}€` : ""})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSuspended}
              aria-busy={isSubmitting}
              className={`w-full sm:w-auto justify-center px-7 py-3.5 rounded-2xl text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-2 ${
                isSuspended
                  ? "bg-zinc-200 text-zinc-600 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white cursor-pointer disabled:cursor-wait disabled:opacity-75 disabled:active:scale-100"
              }`}
            >
              {isSubmitting ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : isSuspended ? <PauseCircle aria-hidden="true" className="w-4 h-4" /> : <FileText aria-hidden="true" className="w-4 h-4" />}
              <span>{isSubmitting ? "A criar envio…" : isSuspended ? "Criação de Envios Suspensa" : "Criar Envio"}</span>
            </button>
          </div>

          {/* Error banner — shown when CTT or validation rejects the shipment */}
          {submitError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-300 text-red-800 rounded-2xl px-5 py-4 text-xs font-medium animate-in fade-in slide-in-from-top-2 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">
                <div className="font-bold text-red-700 mb-0.5">Envio não criado — pedido rejeitado</div>
                <div className="text-red-700">{submitError}</div>
                {submitError.includes("Saldo Insuficiente") && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => setIsTopUpOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Carregar Saldo Agora</span>
                    </button>
                  </div>
                )}
                {fieldError === "special" && (
                  <div className="mt-1.5 text-red-600">
                    💡 Dica: Desmarque os serviços especiais (Frágil, Retorno, SMS) e tente novamente sem eles.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSubmitError(null); setFieldError(null) }}
                className="text-red-400 hover:text-red-700 text-lg leading-none font-bold ml-auto"
              >×</button>
            </div>
          )}

        </form>
      </div>

      {/* Tabela de Envios Criados na Sessão */}
      {sessionShipments.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900">Envios Criados Nesta Sessão</h3>
            <span className="text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-md">
              {sessionShipments.length} envios
            </span>
          </div>

          {/* Mobile cards view */}
          <div className="md:hidden divide-y divide-zinc-100">
            {sessionShipments.map((item, idx) => (
              <div key={idx} className="py-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#2d533d]">{item.guia}</span>
                  <span className="font-mono font-bold text-zinc-900">{item.valor}</span>
                </div>
                <div className="text-zinc-800 font-semibold">{item.destinatario}</div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    {getCarrierLogo(item.servico || item.transportadora || "ctt") ? (
                      <div className="w-4 h-4 rounded bg-white border border-zinc-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getCarrierLogo(item.servico || item.transportadora || "ctt")!}
                          alt="Logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : null}
                    <span>{getClientServiceName(item.servico)}</span>
                  </div>
                  <span>{item.data}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600 font-bold">
                  <th className="pb-3">Guia</th>
                  <th className="pb-3">Destinatário</th>
                  <th className="pb-3">Serviço</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sessionShipments.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50">
                    <td className="py-3 font-mono font-bold text-zinc-900">{item.guia}</td>
                    <td className="py-3 text-zinc-700">{item.destinatario}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {getCarrierLogo(item.servico || item.transportadora || "ctt") ? (
                          <div className="w-4 h-4 rounded bg-white border border-zinc-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getCarrierLogo(item.servico || item.transportadora || "ctt")!}
                              alt="Logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : null}
                        <span className="text-zinc-700 font-medium">{getClientServiceName(item.servico)}</span>
                      </div>
                    </td>
                    <td className="py-3 text-zinc-500">{item.data}</td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-900">{item.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Carregamento de Saldo Stripe */}
      <ClientTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        clientId={currentClient?.id || ""}
      />

    </div>
  )
}
