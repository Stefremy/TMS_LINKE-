"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  Sparkles
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { emitClientGuiaAction } from "@/app/actions/shipments"
import { 
  Cliente, 
  DEFAULT_CLIENT_PRICING, 
  SYSTEM_AVAILABLE_WEBSERVICES, 
  DEFAULT_CTT_SERVICES_PRICING, 
  DEFAULT_CTT_SPECIAL_SERVICES_FEES,
  ClientServicePrice,
  ClientSpecialServiceFee
} from "@/app/ops/entidades/clientes/types"

export function ClientCreateGuia() {
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
  const [recipientPhone, setRecipientPhone] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [weight, setWeight] = React.useState("1.50")
  const [selectedCarrierCode, setSelectedCarrierCode] = React.useState<string>("ctt_expresso")
  const [selectedServiceCode, setSelectedServiceCode] = React.useState<string>("ctt_24h")
  const [volumesCount, setVolumesCount] = React.useState("1")

  // Special Services selections
  const [isCOD, setIsCOD] = React.useState(false)
  const [codAmount, setCodAmount] = React.useState("50.00")
  const [isInsurance, setIsInsurance] = React.useState(false)
  const [insuredValue, setInsuredValue] = React.useState("250.00")
  const [isFragil, setIsFragil] = React.useState(false)
  const [isSMSNotification, setIsSMSNotification] = React.useState(true)

  // Generation feedback & session history
  const [generatedGuia, setGeneratedGuia] = React.useState<string | null>(null)
  const [generatedLabelBase64, setGeneratedLabelBase64] = React.useState<string | null>(null)
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

    // 2. Special Insurance
    if (isInsurance) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "insurance")
      const pct = feeCfg?.percentage_value ?? 1.0
      const minVal = feeCfg?.min_value ?? 3.50
      const insVal = parseFloat(insuredValue) || 0
      const fee = Math.max(insVal * (pct / 100), minVal)
      specialTotal += fee
      activeSpecialItems.push({ name: "Seguro Extra", amount: fee })
    }

    // 3. Fragil
    if (isFragil) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "fragil")
      const fee = feeCfg?.fixed_value ?? 1.50
      specialTotal += fee
      activeSpecialItems.push({ name: "Tratamento Frágil", amount: fee })
    }

    // 4. SMS
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
    isInsurance,
    insuredValue,
    isFragil,
    isSMSNotification,
  ])

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientName) {
      alert("Por favor indique o nome do destinatário.")
      return
    }

    const numericVal = parseFloat(calculatedPrice.total) || 0
    const chosenService = activeServiceObj?.service_name || "ERS 24 / CTT 24H"

    try {
      const res = await emitClientGuiaAction({
        clientId: currentClient?.id,
        clientName: currentClient?.short_name || currentClient?.legal_name,
        senderAddress: currentClient?.address || "Sede Comercial",
        senderCity: currentClient?.city || "Portugal",
        senderPostal: currentClient?.postal_code || "",
        recipientName,
        recipientAddress,
        recipientCity,
        recipientPostal,
        recipientPhone,
        recipientEmail,
        weightKg: parseFloat(weight) || 1.0,
        volumesCount: parseInt(volumesCount) || 1,
        serviceName: chosenService,
        calculatedPrice: numericVal,
      })

      const newCode = res.guia

      const newShipment = {
        guia: newCode,
        destinatario: `${recipientName}${recipientCity ? `, ${recipientCity}` : ""}`,
        transportadora: "CTT Expresso",
        servico: chosenService,
        estado: "pendente",
        data: new Date().toLocaleDateString("pt-PT"),
        valor: `${calculatedPrice.total}€`,
        numericValue: numericVal,
      }

      setSessionShipments((prev) => [newShipment, ...prev])
      setGeneratedGuia(newCode)
      setGeneratedLabelBase64(res.labelBase64 || null)

      setRecipientName("")
      setRecipientAddress("")
      setRecipientCity("")
      setRecipientPostal("")
      setRecipientPhone("")
      setRecipientEmail("")
      setVolumesCount("1")
    } catch (err: any) {
      alert("Erro ao emitir guia: " + err.message)
    }
  }

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  const senderName = currentClient?.legal_name || currentClient?.short_name || "Empresa Cliente"
  const senderAddress = currentClient?.address 
    ? `${currentClient.address}, ${currentClient.postal_code} ${currentClient.city}` 
    : "Sede Comercial da Empresa"

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href={`/app${querySuffix}`} className="hover:text-emerald-700">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-emerald-600 font-bold">Novo Envio</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Criar Novo Envio</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Emissão direta com produtos CTT Expresso, serviços suplementares e preçário personalizado da sua conta.
          </p>
        </div>

        {currentClient && (
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-2xs text-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900">{currentClient.short_name}</div>
              <div className="text-[10px] text-slate-400 font-mono">Conta: {currentClient.code}</div>
            </div>
          </div>
        )}
      </div>

      {/* Success notification banner */}
      {generatedGuia && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Guia CTT Emitida com Sucesso!</span>
                <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-lg font-bold">
                  {generatedGuia}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                O envio foi registado com o produto <strong>{activeServiceObj?.service_name}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/app${querySuffix}`}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span>Ver no Painel</span>
            </Link>
            <Link
              href={`/app/envios${querySuffix}`}
              className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <span>Ver no Histórico</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                if (generatedLabelBase64) {
                  const link = document.createElement("a")
                  link.href = `data:application/pdf;base64,${generatedLabelBase64}`
                  link.download = `Guia_${generatedGuia}.pdf`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                } else {
                  window.print()
                }
              }}
              className="bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-950 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{generatedLabelBase64 ? "Descarregar Etiqueta" : "Imprimir Página"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGeneratedGuia(null)
                setGeneratedLabelBase64(null)
              }}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Card Form */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <form onSubmit={handleCreateShipment} className="space-y-6">
          
          {/* Remetente e Destinatário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Remetente Card */}
            <div className="space-y-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">Remetente (A sua Empresa)</label>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">Conta Ativa</span>
              </div>
              <div className="text-xs text-slate-900 font-bold">{senderName}</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">{senderAddress}</div>
            </div>

            {/* Destinatário Name */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Nome do Destinatário *</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Comercial Lisboa Lda ou Maria Fernandes" 
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" 
              />
            </div>
          </div>

          {/* Morada, Localidade, CP, Telefone e Peso */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Morada de Entrega *</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  placeholder="Rua, avenida, número, andar, porta..." 
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
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
                  className="w-1/2 px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                />
                <input 
                  type="text" 
                  placeholder="Porto" 
                  value={recipientCity}
                  onChange={(e) => setRecipientCity(e.target.value)}
                  className="w-1/2 px-2.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
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
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Telefone do Destinatário</label>
              <input 
                type="text" 
                placeholder="Ex: 910000000" 
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Email do Destinatário</label>
              <input 
                type="email" 
                placeholder="email@exemplo.pt" 
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Nº de Volumes *</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={volumesCount}
                onChange={(e) => setVolumesCount(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
          </div>

          {/* SELEÇÃO DO PRODUTO / SUB-PRODUTO CTT */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Produto & Sub-Produto de Transporte CTT (SubProductId)</span>
              </label>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                {activeServiceObj?.category}
              </span>
            </div>

            <div className="relative">
              <select 
                value={selectedServiceCode}
                onChange={(e) => setSelectedServiceCode(e.target.value)}
                className="w-full pl-3.5 pr-8 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                {servicesPricingList.filter(s => s.is_enabled).map((service) => (
                  <option key={service.service_code} value={service.service_code}>
                    [{service.category}] {service.service_name} — (SubProduto: {service.subproduct_id})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 pl-1">{activeServiceObj?.description}</p>
          </div>

          {/* SERVIÇOS ESPECIAIS E SUPLEMENTARES */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Serviços Especiais & Suplementares CTT (SpecialServices)</span>
              </label>
              <span className="text-[11px] text-slate-400">Opcionais por envio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              
              {/* 1. Cobrança / AgainstReimbursement */}
              <div className={`p-3 rounded-xl border transition-colors ${isCOD ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="opt_cod"
                    checked={isCOD} 
                    onChange={(e) => setIsCOD(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                  <label htmlFor="opt_cod" className="font-bold text-slate-800 cursor-pointer text-xs">
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
                      className="w-24 border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                )}
              </div>

              {/* 2. Special Insurance */}
              <div className={`p-3 rounded-xl border transition-colors ${isInsurance ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="opt_ins"
                    checked={isInsurance} 
                    onChange={(e) => setIsInsurance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                  <label htmlFor="opt_ins" className="font-bold text-slate-800 cursor-pointer text-xs">
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
                      className="w-24 border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                )}
              </div>

              {/* 3. Fragil */}
              <div className={`p-3 rounded-xl border transition-colors ${isFragil ? "bg-emerald-50/50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="opt_frag"
                    checked={isFragil} 
                    onChange={(e) => setIsFragil(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                  <label htmlFor="opt_frag" className="font-bold text-slate-800 cursor-pointer text-xs">
                    Mercadoria Frágil
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 pl-6 mt-1">+1.50€ manuseamento</p>
              </div>

            </div>
          </div>

          {/* SIMULAÇÃO DE PREÇO & BOTÃO DE EMISSÃO */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 bg-slate-50/80 p-5 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Euro className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Preço Total Estimado do Envio (sem IVA):</div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    {calculatedPrice.total}€
                  </span>
                  <span className="text-[11px] text-slate-500">
                    (Base: <strong>{calculatedPrice.base}€</strong> + Comb. {calculatedPrice.fuelPct}%: <strong>{calculatedPrice.fuel}€</strong>
                    {parseFloat(calculatedPrice.specialTotal) > 0 ? ` + Supl.: ${calculatedPrice.specialTotal}€` : ""}
                    {calculatedPrice.discountPct > 0 ? ` - Desc: ${calculatedPrice.discountPct}%` : ""})
                  </span>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-7 py-3.5 rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Criar Envio</span>
            </button>
          </div>

        </form>
      </div>

      {/* Tabela de Envios Criados na Sessão */}
      {sessionShipments.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Envios Criados Nesta Sessão</h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              {sessionShipments.length} envios
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="pb-3">Guia</th>
                  <th className="pb-3">Destinatário</th>
                  <th className="pb-3">Serviço CTT</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionShipments.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-slate-900">{item.guia}</td>
                    <td className="py-3 text-slate-700">{item.destinatario}</td>
                    <td className="py-3 text-slate-600">{item.servico}</td>
                    <td className="py-3 text-slate-500">{item.data}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">{item.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
