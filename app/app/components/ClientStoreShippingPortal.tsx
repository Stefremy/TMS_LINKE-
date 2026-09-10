"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { 
  Calendar, 
  ChevronDown, 
  CheckCircle2, 
  TrendingUp, 
  MapPin, 
  FileText, 
  Truck, 
  Euro, 
  ShieldCheck, 
  Check, 
  AlertCircle,
  Building2,
  Printer,
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
  Info
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { 
  Cliente, 
  DEFAULT_CLIENT_PRICING, 
  SYSTEM_AVAILABLE_WEBSERVICES, 
  DEFAULT_CTT_SERVICES_PRICING,
  DEFAULT_CTT_SPECIAL_SERVICES_FEES,
  ClientAllowedWebservice,
  ClientServicePrice,
  ClientSpecialServiceFee
} from "@/app/ops/entidades/clientes/types"

export function ClientStoreShippingPortal() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [loadingClient, setLoadingClient] = React.useState(true)

  // Form states for Guia
  const [recipientName, setRecipientName] = React.useState("")
  const [recipientAddress, setRecipientAddress] = React.useState("")
  const [recipientCity, setRecipientCity] = React.useState("")
  const [recipientPostal, setRecipientPostal] = React.useState("")
  const [weight, setWeight] = React.useState("1.50")
  const [selectedCarrierCode, setSelectedCarrierCode] = React.useState<string>("ctt_expresso")
  const [selectedServiceCode, setSelectedServiceCode] = React.useState<string>("ctt_24h")
  const [volumesCount, setVolumesCount] = React.useState("1")

  // Special Services selections
  const [isCOD, setIsCOD] = React.useState(false)
  const [codAmount, setCodAmount] = React.useState("50.00")
  const [isSaturday, setIsSaturday] = React.useState(false)
  const [isReturnSigned, setIsReturnSigned] = React.useState(false)
  const [isInsurance, setIsInsurance] = React.useState(false)
  const [insuredValue, setInsuredValue] = React.useState("250.00")
  const [isFragil, setIsFragil] = React.useState(false)
  const [isTimeWindow, setIsTimeWindow] = React.useState(false)
  const [timeWindowSlot, setTimeWindowSlot] = React.useState("10h-13h")
  const [isSMSNotification, setIsSMSNotification] = React.useState(true)

  // Generation feedback
  const [generatedGuia, setGeneratedGuia] = React.useState<string | null>(null)
  const [shipmentsList, setShipmentsList] = React.useState<Array<{
    guia: string
    destinatario: string
    transportadora: string
    servico: string
    estado: string
    data: string
    valor: string
    numericValue: number
  }>>([])

  // Pickup Form state
  const [pickupDate, setPickupDate] = React.useState(new Date().toISOString().split("T")[0])
  const [pickupVolumes, setPickupVolumes] = React.useState("2")
  const [pickupSuccess, setPickupSuccess] = React.useState(false)

  // Load client data
  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }

      if (target) {
        setCurrentClient(target)
        const allowed = (target.allowed_webservices || SYSTEM_AVAILABLE_WEBSERVICES).filter((w) => w.is_enabled)
        const defWs = allowed.find((w) => w.is_default) || allowed[0]
        if (defWs) {
          setSelectedCarrierCode(defWs.code)
        }
      }
      setLoadingClient(false)
    })
  }, [clientId, clientNameParam])

  // Available client services pricing
  const servicesPricingList: ClientServicePrice[] = React.useMemo(() => {
    return currentClient?.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING
  }, [currentClient])

  // Available special services fees
  const specialFeesList: ClientSpecialServiceFee[] = React.useMemo(() => {
    return currentClient?.pricing?.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES
  }, [currentClient])

  // Active chosen service
  const activeServiceObj = servicesPricingList.find((s) => s.service_code === selectedServiceCode) || servicesPricingList[0]

  // Compute live simulated price using exact client CTT products & special services
  const calculatedPrice = React.useMemo(() => {
    const pricing = currentClient?.pricing || DEFAULT_CLIENT_PRICING
    const srv = activeServiceObj || DEFAULT_CTT_SERVICES_PRICING[0]

    const w = parseFloat(weight) || 1.0
    let base = srv.w_0_1
    if (w <= 1) base = srv.w_0_1
    else if (w <= 2) base = srv.w_1_2
    else if (w <= 5) base = srv.w_2_5
    else if (w <= 10) base = srv.w_5_10
    else if (w <= 20) base = srv.w_10_20
    else if (w <= 30) base = srv.w_20_30
    else {
      const extraKg = Math.ceil(w - 30)
      base = srv.w_20_30 + extraKg * srv.kg_extra
    }

    // Fuel Surcharge %
    const fuelPct = pricing.fuel_surcharge_pct ?? 12.5
    const fuelVal = base * (fuelPct / 100)

    // Special Services calculations
    let specialTotal = 0
    const activeSpecialItems: { name: string; amount: number }[] = []

    // 1. COD (Cobrança)
    if (isCOD) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "cod")
      const pct = feeCfg?.percentage_value ?? 2.0
      const minVal = feeCfg?.min_value ?? 1.80
      const codVal = parseFloat(codAmount) || 0
      const fee = Math.max(codVal * (pct / 100), minVal)
      specialTotal += fee
      activeSpecialItems.push({ name: "Cobrança / Reembolso", amount: fee })
    }

    // 2. Saturday
    if (isSaturday) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "saturday")
      const fee = feeCfg?.fixed_value ?? 8.50
      specialTotal += fee
      activeSpecialItems.push({ name: "Entrega Sábado", amount: fee })
    }

    // 3. Return Document Signed
    if (isReturnSigned) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "return_signed")
      const fee = feeCfg?.fixed_value ?? 2.20
      specialTotal += fee
      activeSpecialItems.push({ name: "Guia Assinada", amount: fee })
    }

    // 4. Special Insurance
    if (isInsurance) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "insurance")
      const pct = feeCfg?.percentage_value ?? 1.0
      const minVal = feeCfg?.min_value ?? 3.50
      const insVal = parseFloat(insuredValue) || 0
      const fee = Math.max(insVal * (pct / 100), minVal)
      specialTotal += fee
      activeSpecialItems.push({ name: "Seguro Extra", amount: fee })
    }

    // 5. Fragil
    if (isFragil) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "fragil")
      const fee = feeCfg?.fixed_value ?? 1.50
      specialTotal += fee
      activeSpecialItems.push({ name: "Tratamento Frágil", amount: fee })
    }

    // 6. Time Window
    if (isTimeWindow) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "time_window")
      const fee = feeCfg?.fixed_value ?? 3.50
      specialTotal += fee
      activeSpecialItems.push({ name: `Janela Horária (${timeWindowSlot})`, amount: fee })
    }

    // 7. SMS
    if (isSMSNotification) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "sms_tracking")
      const fee = feeCfg?.fixed_value ?? 0.15
      specialTotal += fee
      activeSpecialItems.push({ name: "Alerta SMS & Tracking", amount: fee })
    }

    // Subtotal and Discount
    const subtotal = base + fuelVal + specialTotal
    const discPct = pricing.discount_pct || 0
    const discountVal = subtotal * (discPct / 100)
    const finalTotal = Math.max(subtotal - discountVal, 0)

    return {
      base: base.toFixed(2),
      fuel: fuelVal.toFixed(2),
      fuelPct,
      specialTotal: specialTotal.toFixed(2),
      specialItems: activeSpecialItems,
      discount: discountVal.toFixed(2),
      discountPct: discPct,
      total: finalTotal.toFixed(2),
    }
  }, [
    currentClient,
    activeServiceObj,
    weight,
    specialFeesList,
    isCOD,
    codAmount,
    isSaturday,
    isReturnSigned,
    isInsurance,
    insuredValue,
    isFragil,
    isTimeWindow,
    timeWindowSlot,
    isSMSNotification,
  ])

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientName) {
      alert("Por favor indique o nome do destinatário.")
      return
    }

    const newCode = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
    const numericVal = parseFloat(calculatedPrice.total) || 0
    const newShipment = {
      guia: newCode,
      destinatario: `${recipientName}${recipientCity ? `, ${recipientCity}` : ""}`,
      transportadora: "CTT Expresso",
      servico: activeServiceObj?.service_name || "CTT 24H (Premium D+1)",
      estado: "pendente",
      data: new Date().toLocaleDateString("pt-PT"),
      valor: `${calculatedPrice.total}€`,
      numericValue: numericVal,
    }

    setShipmentsList([newShipment, ...shipmentsList])
    setGeneratedGuia(newCode)

    setRecipientName("")
    setRecipientAddress("")
    setRecipientCity("")
    setRecipientPostal("")
  }

  const handleConfirmPickup = (e: React.FormEvent) => {
    e.preventDefault()
    setPickupSuccess(true)
    setTimeout(() => setPickupSuccess(false), 5000)
  }

  const senderName = currentClient?.legal_name || currentClient?.short_name || "Empresa Cliente"
  const senderAddress = currentClient?.address 
    ? `${currentClient.address}, ${currentClient.postal_code} ${currentClient.city}` 
    : "Sede Comercial da Empresa"

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      
      {/* Left Column (Forms) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        
        {/* Criar Nova Guia Card */}
        <div id="criar-guia" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 scroll-mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Criar Nova Guia de Transporte</h2>
              <p className="text-xs text-slate-500">
                Emissão direta com produtos CTT Expresso, serviços especiais e preçário personalizado.
              </p>
            </div>

            {currentClient && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conta: {currentClient.short_name}</span>
                <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded">
                  {currentClient.code}
                </span>
              </div>
            )}
          </div>

          {generatedGuia && (
            <div className="mb-6 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span>Guia Criada com Sucesso!</span>
                    <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                      {generatedGuia}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    O envio foi registado com o serviço <strong>{activeServiceObj?.service_name}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Etiqueta CTT
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedGuia(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1 cursor-pointer"
                >
                  Dispensar
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateShipment} className="space-y-5">
            
            {/* Remetente & Destinatário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Remetente (A sua Empresa)</label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded">Conta Ativa</span>
                </div>
                <div className="text-xs text-slate-800 font-semibold">{senderName}</div>
                <div className="text-[11px] text-slate-500 truncate">{senderAddress}</div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Nome do Destinatário *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Armazéns Silva, Lda ou Maria Santos" 
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" 
                />
              </div>
            </div>

            {/* Morada Destino & Peso */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Morada de Entrega *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    placeholder="Rua, número, andar, porta..." 
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Código Postal & Cidade</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="4000-001" 
                    value={recipientPostal}
                    onChange={(e) => setRecipientPostal(e.target.value)}
                    className="w-1/2 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  <input 
                    type="text" 
                    placeholder="Porto" 
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    className="w-1/2 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Peso Total (kg) *</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
            </div>

            {/* SELEÇÃO DO PRODUTO / SUB-PRODUTO CTT */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  Produto & Sub-Produto de Transporte CTT (SubProductId)
                </label>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-full">
                  {activeServiceObj?.category}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="relative">
                    <select 
                      value={selectedServiceCode}
                      onChange={(e) => setSelectedServiceCode(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                    >
                      {servicesPricingList.filter(s => s.is_enabled).map((service) => (
                        <option key={service.service_code} value={service.service_code}>
                          [{service.category}] {service.service_name} — (SubProduto: {service.subproduct_id})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-500">{activeServiceObj?.description}</p>
                </div>
              </div>
            </div>

            {/* SERVIÇOS ESPECIAIS E SUPLEMENTARES (SpecialServices) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <label className="block text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Serviços Especiais & Suplementares CTT (SpecialServices)
                </label>
                <span className="text-[11px] text-slate-500">Opcionais por envio</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                
                {/* 1. Cobrança / AgainstReimbursement */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isCOD ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_cod"
                      checked={isCOD} 
                      onChange={(e) => setIsCOD(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_cod" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Cobrança / Reembolso (COD)
                    </label>
                  </div>
                  {isCOD && (
                    <div className="mt-2 pl-6 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Valor (€):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={codAmount}
                        onChange={(e) => setCodAmount(e.target.value)}
                        className="w-24 border border-slate-300 rounded px-2 py-0.5 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Saturday */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isSaturday ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_sat"
                      checked={isSaturday} 
                      onChange={(e) => setIsSaturday(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_sat" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Entrega ao Sábado (10h-14h)
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-6 mt-1">+8.50€ taxa suplementar</p>
                </div>

                {/* 3. Return Document Signed */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isReturnSigned ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_return"
                      checked={isReturnSigned} 
                      onChange={(e) => setIsReturnSigned(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_return" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Guia Assinada e Carimbada
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-6 mt-1">+2.20€ devolução comprovativo</p>
                </div>

                {/* 4. Special Insurance */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isInsurance ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_ins"
                      checked={isInsurance} 
                      onChange={(e) => setIsInsurance(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_ins" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Seguro Extra / Valor Declarado
                    </label>
                  </div>
                  {isInsurance && (
                    <div className="mt-2 pl-6 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Valor (€):</span>
                      <input
                        type="number"
                        step="10"
                        value={insuredValue}
                        onChange={(e) => setInsuredValue(e.target.value)}
                        className="w-24 border border-slate-300 rounded px-2 py-0.5 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* 5. Fragil */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isFragil ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_frag"
                      checked={isFragil} 
                      onChange={(e) => setIsFragil(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_frag" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Mercadoria Frágil
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-6 mt-1">+1.50€ manuseamento</p>
                </div>

                {/* 6. Time Window */}
                <div className={`p-2.5 rounded-lg border transition-colors ${isTimeWindow ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="opt_time"
                      checked={isTimeWindow} 
                      onChange={(e) => setIsTimeWindow(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="opt_time" className="font-bold text-slate-800 cursor-pointer text-[11px]">
                      Janela Horária Agendada
                    </label>
                  </div>
                  {isTimeWindow && (
                    <div className="mt-2 pl-6">
                      <select
                        value={timeWindowSlot}
                        onChange={(e) => setTimeWindowSlot(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-0.5 text-[11px] font-medium bg-white"
                      >
                        <option value="08h-10h">08h00 às 10h00</option>
                        <option value="10h-13h">10h00 às 13h00</option>
                        <option value="13h-16h">13h00 às 16h00</option>
                        <option value="16h-19h">16h00 às 19h00</option>
                        <option value="19h-22h">19h00 às 22h00</option>
                      </select>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Preço Simulado & Botão Gerar Guia */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200 bg-slate-50 p-4 rounded-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Euro className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Preço Total Estimado do Envio (sem IVA):</div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {calculatedPrice.total}€
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Base: <strong>{calculatedPrice.base}€</strong> + Comb. {calculatedPrice.fuelPct}%: <strong>{calculatedPrice.fuel}€</strong>
                      {parseFloat(calculatedPrice.specialTotal) > 0 ? ` + Supl.: ${calculatedPrice.specialTotal}€` : ""})
                    </span>
                  </div>
                  {calculatedPrice.specialItems.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {calculatedPrice.specialItems.map((item, i) => (
                        <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                          {item.name}: +{item.amount.toFixed(2)}€
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Emitir Guia de Transporte CTT</span>
              </button>
            </div>

          </form>
        </div>

        {/* Pedir Recolha Card */}
        <div id="recolhas" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 scroll-mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pedir Recolha CTT</h2>
              <p className="text-xs text-slate-500">Agende a passagem do estafeta CTT nas suas instalações.</p>
            </div>
          </div>

          {pickupSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Pedido de recolha CTT registado com sucesso para a data indicada!
            </div>
          )}

          <form onSubmit={handleConfirmPickup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Data de Recolha</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Nº de Volumes Previstos</label>
              <input 
                type="number" 
                min="1"
                value={pickupVolumes}
                onChange={(e) => setPickupVolumes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">Morada de Recolha</label>
              <input 
                type="text" 
                defaultValue={senderAddress}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            
            <div className="md:col-span-2 flex items-center justify-end pt-2">
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                Confirmar Pedido de Recolha
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column (Real Dynamic Stats & Table) */}
      <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
        
        {/* Resumo da Conta Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Resumo da Conta</h2>
              <span className="text-[11px] text-slate-500">{currentClient?.short_name || "Cliente"}</span>
            </div>
          </div>
          
          <div className="space-y-5 text-xs">
            <div>
              <p className="text-slate-500 font-semibold mb-0.5">Total de Guias Emitidas (Sessão)</p>
              <p className="text-3xl font-black text-emerald-600 font-mono">{shipmentsList.length}</p>
            </div>
            
            <div className="h-px bg-slate-100 w-full" />
            
            <div>
              <p className="text-slate-500 font-semibold mb-0.5">Total Faturado (Sessão)</p>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {shipmentsList.reduce((acc, s) => acc + (s.numericValue || 0), 0).toFixed(2)}€
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Condições: {currentClient?.payment_terms || "Pronto Pagamento"}</p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            <div>
              <div className="flex justify-between items-end mb-1.5">
                <p className="text-slate-600 font-bold">Limite de Crédito</p>
                <p className="font-bold text-emerald-600">
                  {currentClient?.credit_limit && currentClient.credit_limit > 0
                    ? `${Math.min(
                        (shipmentsList.reduce((acc, s) => acc + (s.numericValue || 0), 0) / currentClient.credit_limit) * 100,
                        100
                      ).toFixed(1)}%`
                    : "Ilimitado"}
                </p>
              </div>
              {currentClient?.credit_limit && currentClient.credit_limit > 0 ? (
                <>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.min(
                          (shipmentsList.reduce((acc, s) => acc + (s.numericValue || 0), 0) / currentClient.credit_limit) * 100,
                          100
                        )}%` 
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {shipmentsList.reduce((acc, s) => acc + (s.numericValue || 0), 0).toFixed(2)}€ de {currentClient.credit_limit.toLocaleString("pt-PT")}€
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">Sem limite de crédito fixado.</p>
              )}
            </div>

            {currentClient?.pricing?.discount_pct ? (
              <>
                <div className="h-px bg-slate-100 w-full" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Desconto Contratual:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                    {currentClient.pricing.discount_pct}%
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Últimos Envios Table Card */}
        <div id="envios" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 scroll-mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Últimos Envios</h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {shipmentsList.length} guias
            </span>
          </div>

          {shipmentsList.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Nenhuma guia emitida ainda</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                As guias de transporte emitidas nesta sessão serão listadas aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-700 font-bold">
                    <th className="pb-2.5">Guia</th>
                    <th className="pb-2.5">Destinatário</th>
                    <th className="pb-2.5">Estado</th>
                    <th className="pb-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipmentsList.map((envio, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 font-bold font-mono text-slate-900">{envio.guia}</td>
                      <td className="py-2.5 text-slate-600 truncate max-w-[120px]">{envio.destinatario}</td>
                      <td className="py-2.5">
                        <Badge variant={
                          envio.estado === "entregue" ? "success" :
                          envio.estado === "pendente" ? "warning" : "info"
                        }>
                          {envio.estado === "em transito" ? "Em Trânsito" : 
                           envio.estado.charAt(0).toUpperCase() + envio.estado.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-800">{envio.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
