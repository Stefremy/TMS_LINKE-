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
  Sparkles,
  Download
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { getServicosLinkeAction } from "@/app/actions/servicos-linke"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { emitClientGuiaAction } from "@/app/actions/shipments"
import { convertZplToPdfAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { 
  Cliente, 
  DEFAULT_CLIENT_PRICING, 
  SYSTEM_AVAILABLE_WEBSERVICES, 
  DEFAULT_CTT_SERVICES_PRICING, 
  DEFAULT_CTT_SPECIAL_SERVICES_FEES,
  ClientServicePrice,
  ClientSpecialServiceFee
} from "@/app/ops/entidades/clientes/types"
import { getCarrierLogo } from "@/lib/carrier-logos"

export function ClientCreateGuia() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
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
  const [selectedCarrierCode, setSelectedCarrierCode] = React.useState<string>("ctt_expresso")
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>("")
  const [volumesCount, setVolumesCount] = React.useState("1")

  // Special Services selections
  const [isCOD, setIsCOD] = React.useState(false)
  const [codAmount, setCodAmount] = React.useState("50.00")
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

  // Load client data & Linke services
  React.useEffect(() => {
    Promise.all([getClientesAction(), getServicosLinkeAction()]).then(([clients, servicos]) => {
      setServicosLinke(servicos || [])
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

        // Set initial selected Linke service based on client's assigned table
        const activeServicos = (servicos || []).filter((s) => s.is_active !== false)
        if (target.default_linke_table_id) {
          const match = activeServicos.find((s) => s.id === target.default_linke_table_id)
          if (match) {
            setSelectedServiceId(match.id)
          } else if (activeServicos.length > 0) {
            setSelectedServiceId(activeServicos[0].id)
          }
        } else if (activeServicos.length > 0) {
          setSelectedServiceId(activeServicos[0].id)
        }
      }
      setLoadingClient(false)
    })
  }, [clientId, clientNameParam])

  // Available Linke services
  const availableServicos = React.useMemo(() => {
    const active = servicosLinke.filter((s) => s.is_active !== false)
    if (active.length === 0) return []
    if (currentClient?.default_linke_table_id) {
      const match = active.find((s) => s.id === currentClient.default_linke_table_id)
      if (match) {
        return [match, ...active.filter((s) => s.id !== match.id)]
      }
    }
    return active
  }, [servicosLinke, currentClient])

  // Active chosen Linke service
  const activeLinkeService = availableServicos.find((s) => s.id === selectedServiceId) || availableServicos[0]

  // Available special services fees
  const specialFeesList: ClientSpecialServiceFee[] = React.useMemo(() => {
    return currentClient?.pricing?.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES
  }, [currentClient])

  // Compute live simulated price using exact Linke Table tiers & client special services
  const calculatedPrice = React.useMemo(() => {
    const pricing = currentClient?.pricing || DEFAULT_CLIENT_PRICING
    const srv = activeLinkeService
    const w = parseFloat(weight) || 1.0

    let base = 5.50
    if (srv && srv.zones && srv.zones.length > 0) {
      const zone = srv.zones[0]
      const tiers = (zone.tiers || []).filter((t) => t.enabled !== false).sort((a, b) => a.weight_max - b.weight_max)
      const matchedTier = tiers.find((t) => w <= t.weight_max) || tiers[tiers.length - 1]
      if (matchedTier) {
        if (w > 30 && matchedTier.weight_max >= 999) {
          const tier30 = tiers.find((t) => t.weight_max === 30)
          const base30 = tier30 ? tier30.sell_price : matchedTier.sell_price
          const extraKg = Math.ceil(w - 30)
          base = base30 + extraKg * matchedTier.sell_price
        } else {
          base = matchedTier.sell_price
        }
      }
    }

    // Fuel Surcharge %
    const fuelPct = srv?.fuel_surcharge_pct ?? pricing.fuel_surcharge_pct ?? 12.5
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

    // 2. Fragil
    if (isFragil) {
      const feeCfg = specialFeesList.find((f) => f.special_service_code === "fragil")
      const fee = feeCfg?.fixed_value ?? 1.50
      specialTotal += fee
      activeSpecialItems.push({ name: "Tratamento Frágil", amount: fee })
    }

    // 3. SMS
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
    activeLinkeService,
    weight,
    specialFeesList,
    isCOD,
    codAmount,
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
    const chosenService = activeLinkeService?.name || "Linke Expresso 24H"

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
                O envio foi registado com o serviço <strong>{activeLinkeService?.name || "Linke Expresso 24H"}</strong>.
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
                  className="bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-950 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    let label = generatedLabelBase64
                    const fname = `${generatedGuia || "Envio"}_Etiqueta_CTT.pdf`
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
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-semibold">
                Sem etiqueta CTT — usa "Solicitar" no detalhe do envio
              </span>
            )}
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

          {/* SELEÇÃO DO SERVIÇO LINKE */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={getCarrierLogo(activeLinkeService?.preferred_carrier_name || "ctt") || ""} 
                    alt="CTT Expresso" 
                    className="max-w-full max-h-full object-contain" 
                  />
                </div>
                <span>Serviço de Transporte Linke</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                  {activeLinkeService?.category || "Nacional"}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  Operador: CTT Expresso API
                </span>
              </div>
            </div>

            <div className="relative">
              <select 
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full pl-3.5 pr-8 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                {availableServicos.map((service) => (
                  <option key={service.id} value={service.id}>
                    [{service.category}] {service.name} — ({service.transit_time_label || "24h"})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 pl-1">
              {activeLinkeService?.description || "Serviço expresso porta-a-porta com emissão integrada CTT Expresso."}
            </p>
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
                  <th className="pb-3">Serviço</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionShipments.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-slate-900">{item.guia}</td>
                    <td className="py-3 text-slate-700">{item.destinatario}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        {getCarrierLogo(item.servico || item.transportadora || "ctt") ? (
                          <div className="w-4 h-4 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(item.servico || item.transportadora || "ctt")!} 
                              alt="Logo" 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        ) : null}
                        <span className="text-slate-700 font-medium">{item.servico}</span>
                      </div>
                    </td>
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
