"use client"

import * as React from "react"
import {
  X,
  User,
  MapPin,
  Phone,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Package,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Truck
} from "lucide-react"
import Link from "next/link"
import { Destinatario } from "../types"

interface DestinatarioDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  destinatario: Destinatario | null
}

export function DestinatarioDetailsModal({
  isOpen,
  onClose,
  destinatario,
}: DestinatarioDetailsModalProps) {
  const [copiedAddress, setCopiedAddress] = React.useState(false)
  const [copiedTrackingId, setCopiedTrackingId] = React.useState<string | null>(null)

  if (!isOpen || !destinatario) return null

  const handleCopyAddress = () => {
    const fullAddress = `${destinatario.address}, ${destinatario.postal_code} ${destinatario.city}, ${destinatario.country}`
    navigator.clipboard.writeText(fullAddress)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const handleCopyTracking = (track: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(track)
    setCopiedTrackingId(track)
    setTimeout(() => setCopiedTrackingId(null), 2000)
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${destinatario.address}, ${destinatario.postal_code} ${destinatario.city}`
  )}`

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "entregue":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Entregue</span>
      case "em_distribuicao":
      case "em_transito":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Em Distribuição</span>
      case "incidencia":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Incidência</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status || "Pendente"}</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0 shadow-sm">
              <User className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  Destinatário de Envios
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <Building2 className="w-3 h-3 mr-1 text-slate-500" />
                  Cliente: <strong className="ml-1 text-slate-900">{destinatario.client_name}</strong>
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mt-1.5 leading-snug">
                {destinatario.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total de Envios</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-slate-900">{destinatario.total_shipments}</span>
                <span className="text-xs text-slate-500">guia(s)</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Último Envio</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {new Date(destinatario.last_shipment_date).toLocaleDateString("pt-PT")}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Último Tracking</span>
              <span className="text-xs font-mono font-bold text-slate-900 mt-1 block truncate">
                {destinatario.last_tracking_number}
              </span>
            </div>
          </div>

          {/* Contact and Address Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>Morada de Entrega</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {copiedAddress ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAddress ? "Copiado" : "Copiar"}
                </button>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
                >
                  Google Maps
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </a>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-800">{destinatario.address}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {destinatario.postal_code} {destinatario.city} &bull; {destinatario.country === "PT" ? "Portugal" : destinatario.country}
              </p>
            </div>

            {(destinatario.phone || destinatario.email) && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-600">
                {destinatario.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{destinatario.phone}</span>
                  </div>
                )}
                {destinatario.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{destinatario.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de Envios */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Histórico de Envios ({destinatario.shipments_history.length})</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {destinatario.shipments_history.map((item) => (
                <div key={item.id || item.tracking_number} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {item.ctt_object_id || item.tracking_number}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{item.service_type || "CTT Expresso"}</span>
                      <span>&bull;</span>
                      <span>{new Date(item.created_at).toLocaleDateString("pt-PT")}</span>
                      {item.sell_price && (
                        <>
                          <span>&bull;</span>
                          <span className="font-semibold text-slate-700">{item.sell_price.toFixed(2)}€</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCopyTracking(item.ctt_object_id || item.tracking_number, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Copiar tracking"
                    >
                      {copiedTrackingId === (item.ctt_object_id || item.tracking_number) ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <Link
                      href={`/ops/envios?search=${encodeURIComponent(item.ctt_object_id || item.tracking_number)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                    >
                      Ver Envio
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Histórico gerado automaticamente a partir dos envios dos clientes
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
