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
import { CountryFlag } from "./CountryFlag"

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[var(--surface-bg)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-start justify-between bg-[var(--surface-muted)]">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              ponto.tipoCategoria === "cacifo"
                ? "bg-[#F2EEE8] text-[#8A6944]"
                : ponto.tipoCategoria === "loja"
                ? "bg-[#EDF1F3] text-[#376C8A]"
                : "bg-[#EAF0EC] text-[#477D68]"
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
                    ? "bg-[#F2EEE8] text-[#8A6944] border border-[#DBCCB9]"
                    : ponto.tipoCategoria === "loja"
                    ? "bg-[#EDF1F3] text-[#376C8A] border border-[#C7D4DC]"
                    : "bg-[#EAF0EC] text-[#477D68] border border-[#C9D7CD]"
                }`}>
                  {ponto.tipo}
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-dim)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  <Layers className="w-3 h-3 mr-1 text-[var(--text-tertiary)]" />
                  {ponto.entidadeNome}
                </span>
              </div>

              <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1.5 leading-snug">
                {ponto.nome}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-dim)] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Código PuP */}
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">Código Ponto CTT (PuP ID)</span>
                <span className="font-mono text-base font-bold text-[var(--text-primary)]">{ponto.codigo}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg hover:bg-[var(--surface-dim)] text-[var(--text-secondary)] transition-colors"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[var(--accent)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* País / Rede */}
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider block">Rede / Entidade ID</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Entidade {ponto.entidadeId} · {ponto.pais === "PT" ? "Portugal" : "Espanha"}
                </span>
              </div>
              <CountryFlag country={ponto.pais === "PT" ? "PT" : "ES"} className="h-5 w-7" />
            </div>
          </div>

          {/* Morada Completa & Localização */}
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-sm">
                <MapPin className="w-4 h-4 text-[var(--accent)]" />
                <span>Morada e Localização</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface-dim)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors"
                >
                  {copiedAddress ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAddress ? "Copiado" : "Copiar"}
                </button>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Google Maps
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </a>
              </div>
            </div>

            <p className="text-[var(--text-primary)] text-sm font-medium">
              {ponto.morada} {ponto.numero ? `nº ${ponto.numero}` : ""}
            </p>
            <p className="text-[var(--text-tertiary)] text-sm mt-0.5">
              {ponto.codigoPostal} {ponto.localidade} &bull; {ponto.pais}
            </p>

            {ponto.latitude && ponto.longitude && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-4 text-xs font-mono text-[var(--text-tertiary)]">
                <span>Lat: {ponto.latitude}</span>
                <span>Lng: {ponto.longitude}</span>
              </div>
            )}
          </div>

          {/* Horários de Funcionamento */}
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-sm">
                <Clock className="w-4 h-4 text-[#376C8A]" />
                <span>Horários de Funcionamento</span>
              </div>
              <span className="text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-dim)] px-2.5 py-0.5 rounded-full">
                {ponto.horarioFormatado || "Sob consulta"}
              </span>
            </div>

            {ponto.tipoCategoria === "cacifo" ? (
              <div className="p-3 bg-[#F2EEE8] border border-[#DBCCB9] rounded-lg text-center">
                <p className="text-sm font-semibold text-[#6B5237]">Disponibilidade Permanente 24/7</p>
                <p className="text-xs text-[#8A6944] mt-0.5">Os cacifos automáticos Locky estão acessíveis 24 horas por dia, 7 dias por semana.</p>
              </div>
            ) : ponto.horarios ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Segunda-feira:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{ponto.horarios.segunda || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Terça-feira:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{ponto.horarios.terca || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Quarta-feira:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{ponto.horarios.quarta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Quinta-feira:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{ponto.horarios.quinta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Sexta-feira:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{ponto.horarios.sexta || "Encerrado"}</span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)]">
                  <span className="text-[var(--text-tertiary)] font-medium">Sábado:</span>
                  <span className={`font-semibold ${ponto.horarios.sabado === "Encerrado" ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                    {ponto.horarios.sabado || "Encerrado"}
                  </span>
                </div>
                <div className="flex justify-between py-1 px-2 rounded bg-[var(--surface-muted)] sm:col-span-2">
                  <span className="text-[var(--text-tertiary)] font-medium">Domingo:</span>
                  <span className={`font-semibold ${ponto.horarios.domingo === "Encerrado" ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                    {ponto.horarios.domingo || "Encerrado"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)] italic">Horário detalhado não fornecido pela CTT Expresso.</p>
            )}
          </div>

          {/* Contactos */}
          {(ponto.telefone || ponto.email) && (
            <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-sm space-y-2">
              <span className="text-[var(--text-primary)] font-semibold text-sm block">Contactos</span>
              {ponto.telefone && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Phone className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <a href={`tel:${ponto.telefone}`} className="hover:text-[var(--accent)] font-medium">
                    {ponto.telefone}
                  </a>
                </div>
              )}
              {ponto.email && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Mail className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <a href={`mailto:${ponto.email}`} className="hover:text-[var(--accent)] font-medium">
                    {ponto.email}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)] font-medium">
            Ponto registado na rede CTT Expresso Webservice
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-muted)] shadow-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
