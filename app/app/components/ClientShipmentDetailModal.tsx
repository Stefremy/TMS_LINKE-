"use client"

import * as React from "react"
import { 
  Building2, 
  MapPin, 
  Truck, 
  Zap, 
  Printer, 
  Download,
  RotateCcw,
  Loader2,
  X,
  Package,
  Calendar,
  ShieldCheck,
  Phone,
  Mail,
  AlertCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { regenerateCttLabelAction } from "@/app/actions/shipments"

interface ClientShipmentDetailModalProps {
  shipment: any
  onClose: () => void
  onUpdateShipment?: (updated: any) => void
}

export function ClientShipmentDetailModal({ 
  shipment, 
  onClose,
  onUpdateShipment 
}: ClientShipmentDetailModalProps) {
  if (!shipment) return null

  const [currentShipment, setCurrentShipment] = React.useState(shipment)
  const [isRegenerating, setIsRegenerating] = React.useState(false)

  React.useEffect(() => {
    setCurrentShipment(shipment)
  }, [shipment])

  const tracking = currentShipment.tracking_number || currentShipment.id || "N/A"
  const dateFormatted = currentShipment.created_at
    ? new Date(currentShipment.created_at).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Recentemente"

  // 1. Imprimir Etiqueta CTT
  const printLabel = () => {
    if (!currentShipment.ctt_label_base64) return
    try {
      const byteCharacters = atob(currentShipment.ctt_label_base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const file = new Blob([byteArray], { type: "application/pdf" })
      const fileURL = URL.createObjectURL(file)
      const printWindow = window.open(fileURL, "_blank")
      if (printWindow) {
        printWindow.onload = () => printWindow.print()
      }
    } catch (err) {
      alert("Não foi possível carregar a etiqueta em PDF para impressão.")
    }
  }

  // 2. Descarregar Etiqueta PDF
  const downloadLabel = () => {
    if (!currentShipment.ctt_label_base64) return
    try {
      const link = document.createElement("a")
      link.href = `data:application/pdf;base64,${currentShipment.ctt_label_base64}`
      link.download = `${tracking}_Etiqueta_CTT.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      alert("Erro ao descarregar PDF da etiqueta.")
    }
  }

  // 3. Solicitar / Reemitir Etiqueta aos CTT
  const handleReRequestLabel = async () => {
    setIsRegenerating(true)
    try {
      const res = await regenerateCttLabelAction(currentShipment.id || currentShipment.tracking_number)
      if (res.success && res.labelBase64) {
        const updated = {
          ...currentShipment,
          ctt_label_base64: res.labelBase64,
          tracking_number: res.trackingNumber || currentShipment.tracking_number
        }
        setCurrentShipment(updated)
        if (onUpdateShipment) {
          onUpdateShipment(updated)
        }
      } else {
        alert("Resposta dos CTT: " + (res.error || "Não foi possível obter etiqueta. Verifique as credenciais CTT em /ops/configuracao/webservices."))
      }
    } catch (e: any) {
      alert("Erro de comunicação CTT: " + (e?.message || e))
    } finally {
      setIsRegenerating(false)
    }
  }

  // Extract fields with fallbacks
  const recipientName = currentShipment.recipient_name || ""
  const recipientAddress = currentShipment.recipient_address || ""
  const recipientZip = currentShipment.recipient_zip3 
    ? `${currentShipment.recipient_zip3}-${currentShipment.recipient_zip4 || "000"}`
    : ""
  const recipientCity = currentShipment.recipient_city || ""
  const recipientPhone = currentShipment.recipient_phone || "Não especificado"
  const recipientEmail = currentShipment.recipient_email || "Não especificado"
  const weightKg = currentShipment.weight_kg || currentShipment.weight || "1.00"
  const volumes = currentShipment.volumes_count || currentShipment.volumes || 1
  const serviceType = currentShipment.service_type || "CTT Expresso 24H"

  // Special services status
  const isCOD = Boolean(currentShipment.is_cod || currentShipment.cod_amount)
  const codAmount = currentShipment.cod_amount ? `${Number(currentShipment.cod_amount).toFixed(2)}€` : "—"
  const isInsurance = Boolean(currentShipment.is_insurance || currentShipment.insured_value)
  const insuredValue = currentShipment.insured_value ? `${Number(currentShipment.insured_value).toFixed(2)}€` : "—"
  const isFragil = Boolean(currentShipment.is_fragil)
  const isSMS = currentShipment.is_sms_notification !== false // default true

  const hasLabel = Boolean(currentShipment.ctt_label_base64)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Detalhes do Envio</h3>
                <span className="font-mono text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
                  {tracking}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateFormatted}
                </span>
                <span>•</span>
                <Badge variant={
                  currentShipment.status === "entregue" ? "success" :
                  currentShipment.status === "pendente" ? "warning" : "info"
                }>
                  {currentShipment.status === "em transito" ? "Em Trânsito" : 
                    currentShipment.status?.charAt(0).toUpperCase() + currentShipment.status?.slice(1) || "Pendente"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasLabel ? (
              <>
                <button
                  type="button"
                  onClick={printLabel}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Imprimir etiqueta CTT em nova janela"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Descarregar etiqueta em PDF"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Descarregar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleReRequestLabel}
                  disabled={isRegenerating}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-600 rounded-xl transition-all cursor-pointer"
                  title="Solicitar / Reemitir Etiqueta CTT novamente aos Web Services"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReRequestLabel}
                disabled={isRegenerating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A Obter Etiqueta CTT...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Solicitar Etiqueta CTT</span>
                  </>
                )}
              </button>
            )}

            <button 
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - Creation Form Mirror (Greyed Out / Read-Only) */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          
          {/* Missing label warning if not available */}
          {!hasLabel && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Este envio não tem etiqueta associada em cache. Pode obtê-la diretamente dos Web Services CTT.
                </span>
              </div>
              <button
                type="button"
                onClick={handleReRequestLabel}
                disabled={isRegenerating}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Obter Etiqueta Agora</span>
              </button>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200/80 text-slate-600 rounded-2xl px-4 py-2.5 text-xs flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Modo de Leitura: Dados oficiais registados para a emissão deste envio.</span>
          </div>

          {/* 1. Remetente e Destinatário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Remetente Card */}
            <div className="space-y-2 bg-slate-100/80 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-600">Remetente (Empresa)</label>
                <span className="text-[10px] text-slate-500 font-bold bg-slate-200/80 px-2 py-0.5 rounded-full">Conta Cliente</span>
              </div>
              <div className="text-xs text-slate-800 font-bold">{currentShipment.sender_name || "Empresa Cliente"}</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">
                {currentShipment.sender_address || "Sede Comercial"}
                {currentShipment.sender_zip3 ? ` (${currentShipment.sender_zip3}-${currentShipment.sender_zip4})` : ""}
              </div>
            </div>

            {/* Destinatário Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Nome do Destinatário</label>
              <input 
                type="text" 
                disabled
                value={recipientName}
                className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold cursor-not-allowed select-none" 
              />
            </div>
          </div>

          {/* 2. Morada, CP, Cidade e Peso */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Morada de Entrega</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled
                  value={recipientAddress}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                />
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Código Postal & Cidade</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  disabled
                  value={recipientZip || "—"}
                  className="w-1/2 px-2.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
                />
                <input 
                  type="text" 
                  disabled
                  value={recipientCity || "Portugal"}
                  className="w-1/2 px-2.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-not-allowed select-none" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Peso Total (kg)</label>
              <input 
                type="text" 
                disabled
                value={`${weightKg} kg`}
                className="w-full px-3 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
              />
            </div>
          </div>

          {/* 3. Telefone, Email e Volumes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Telefone do Destinatário</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled
                  value={recipientPhone}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                />
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Email do Destinatário</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled
                  value={recipientEmail}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-not-allowed select-none" 
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">Nº de Volumes</label>
              <input 
                type="text" 
                disabled
                value={`${volumes} ${volumes === 1 ? "volume" : "volumes"}`}
                className="w-full px-3 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none" 
              />
            </div>
          </div>

          {/* 4. Serviço CTT Expresso */}
          <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Produto & Serviço de Transporte CTT</span>
              </label>
              <span className="text-[11px] text-slate-500 font-bold bg-slate-200 px-2.5 py-0.5 rounded-full">
                Contratado
              </span>
            </div>

            <div className="p-3 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>{serviceType}</span>
              <span className="text-emerald-700 font-mono">
                {currentShipment.sell_price ? `${Number(currentShipment.sell_price).toFixed(2)}€` : "—"}
              </span>
            </div>
          </div>

          {/* 5. Serviços Especiais CTT */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Serviços Especiais & Suplementares CTT</span>
              </label>
              <span className="text-[11px] text-slate-400">Estado selecionado</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Cobrança */}
              <div className={`p-3 rounded-xl border ${isCOD ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isCOD} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                  <span className="font-bold text-slate-800 text-[11px]">Cobrança / Reembolso</span>
                </div>
                {isCOD && <p className="text-[10px] text-emerald-700 font-mono font-bold mt-1 pl-5">Valor: {codAmount}</p>}
              </div>

              {/* Seguro */}
              <div className={`p-3 rounded-xl border ${isInsurance ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isInsurance} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                  <span className="font-bold text-slate-800 text-[11px]">Seguro Declarado</span>
                </div>
                {isInsurance && <p className="text-[10px] text-emerald-700 font-mono font-bold mt-1 pl-5">Valor: {insuredValue}</p>}
              </div>

              {/* Frágil */}
              <div className={`p-3 rounded-xl border ${isFragil ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isFragil} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                  <span className="font-bold text-slate-800 text-[11px]">Mercadoria Frágil</span>
                </div>
              </div>

              {/* SMS Notification */}
              <div className={`p-3 rounded-xl border ${isSMS ? "bg-emerald-50 border-emerald-300" : "bg-slate-100/70 border-slate-200 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isSMS} disabled className="w-3.5 h-3.5 rounded text-emerald-600 cursor-not-allowed" />
                  <span className="font-bold text-slate-800 text-[11px]">Alerta SMS Tracking</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Total Faturado: <strong className="text-slate-900 font-mono text-sm">{currentShipment.sell_price ? `${Number(currentShipment.sell_price).toFixed(2)}€` : "0.00€"}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasLabel ? (
              <>
                <button
                  type="button"
                  onClick={printLabel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={downloadLabel}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Descarregar PDF</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReRequestLabel}
                disabled={isRegenerating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Solicitar Etiqueta CTT</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
