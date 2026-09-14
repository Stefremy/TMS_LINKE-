"use client"

import * as React from "react"
import {
  X,
  MapPin,
  Clock,
  Phone,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Package,
  Building2,
  Store,
  Navigation,
  Calendar,
  Layers
} from "lucide-react"
import { CTTPontoEntrega } from "@/lib/services/ctt"

interface PontoDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  ponto: CTTPontoEntrega | null
}

export function PontoDetailsModal({ isOpen, onClose, ponto }: PontoDetailsModalProps) {
  const [copiedCode, setCopiedCode] = React.useState(false)
  const [copiedAddress, setCopiedAddress] = React.useState(false)

  if (!isOpen || !ponto) return null

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ponto.codigo)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyAddress = () => {
    const fullAddress = `${ponto.morada}, ${ponto.codigoPostal} ${ponto.localidade}, ${ponto.pais}`
    navigator.clipboard.writeText(fullAddress)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const googleMapsUrl = ponto.latitude && ponto.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${ponto.latitude},${ponto.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ponto.morada}, ${ponto.codigoPostal} ${ponto.localidade}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              ponto.tipoCategoria === "cacifo"
                ? "bg-purple-100 text-purple-700"
                : ponto.tipoCategoria === "loja"
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }`}>
              {ponto.tipoCategoria === "cacifo" ? (
                <Package className="w-6 h-6" />
              ) : ponto.tipoCategoria === "loja" ? (
                <Building2 className="w-6 h-6" />
              ) : (
                <Store className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  ponto.tipoCategoria === "cacifo"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : ponto.tipoCategoria === "loja"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {ponto.tipo}
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <Layers className="w-3 h-3 mr-1 text-slate-400" />
                  {ponto.entidadeNome}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mt-1.5 leading-snug">
                {ponto.nome}
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Código PuP */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Código Ponto CTT (PuP ID)</span>
                <span className="font-mono text-base font-bold text-slate-900">{ponto.codigo}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg hover:bg-slate-200/70 text-slate-600 transition-colors"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* País / Rede */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Rede / Entidade ID</span>
                <span className="text-sm font-bold text-slate-900">
                  Entidade {ponto.entidadeId} ({ponto.pais})
                </span>
              </div>
              <span className="text-xl">🇵🇹</span>
            </div>
          </div>

          {/* Morada Completa & Localização */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>Morada e Localização</span>
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
                  <Navigation className="w-3.5 h-3.5" />
                  Google Maps
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </a>
              </div>
            </div>

            <p className="text-slate-800 text-sm font-medium">
              {ponto.morada} {ponto.numero ? `nº ${ponto.numero}` : ""}
            </p>
            <p className="text-slate-500 text-sm mt-0.5">
              {ponto.codigoPostal} {ponto.localidade} &bull; {ponto.pais}
            </p>

            {ponto.latitude && ponto.longitude && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs font-mono text-slate-500">
                <span>Lat: {ponto.latitude}</span>
                <span>Lng: {ponto.longitude}</span>
              </div>
            )}
          </div>

          {/* Horários de Funcionamento */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Horários de Funcionamento</span>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {ponto.horarioFormatado || "Sob consulta"}
              </span>
            </div>

            {ponto.tipoCategoria === "cacifo" ? (
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg text-center">
                <p className="text-sm font-semibold text-purple-900">Disponibilidade Permanente 24/7</p>
                <p className="text-xs text-purple-700 mt-0.5">Os cacifos automáticos Locky estão acessíveis 24 horas por dia, 7 dias por semana.</p>
              </div>
            ) : ponto.horarios ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Segunda-feira:</span>
                  <span className="font-semibold text-slate-800">{ponto.horarios.segunda || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Terça-feira:</span>
                  <span className="font-semibold text-slate-800">{ponto.horarios.terca || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Quarta-feira:</span>
                  <span className="font-semibold text-slate-800">{ponto.horarios.quarta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Quinta-feira:</span>
                  <span className="font-semibold text-slate-800">{ponto.horarios.quinta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Sexta-feira:</span>
                  <span className="font-semibold text-slate-800">{ponto.horarios.sexta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50">
                  <span className="text-slate-500 font-medium">Sábado:</span>
                  <span className={`font-semibold ${ponto.horarios.sabado === "Encerrado" ? "text-slate-400" : "text-slate-800"}`}>
                    {ponto.horarios.sabado || "Encerrado"}
                  </span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-slate-50 sm:col-span-2">
                  <span className="text-slate-500 font-medium">Domingo:</span>
                  <span className={`font-semibold ${ponto.horarios.domingo === "Encerrado" ? "text-slate-400" : "text-slate-800"}`}>
                    {ponto.horarios.domingo || "Encerrado"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Horário detalhado não fornecido pela CTT Expresso.</p>
            )}
          </div>

          {/* Contactos */}
          {(ponto.telefone || ponto.email) && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <span className="text-slate-900 font-semibold text-sm block">Contactos</span>
              {ponto.telefone && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${ponto.telefone}`} className="hover:text-green-600 font-medium">
                    {ponto.telefone}
                  </a>
                </div>
              )}
              {ponto.email && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${ponto.email}`} className="hover:text-green-600 font-medium">
                    {ponto.email}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Ponto registado na rede CTT Expresso Webservice
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
