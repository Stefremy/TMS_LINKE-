"use client"

import * as React from "react"
import {
  X,
  UserCheck,
  MapPin,
  Phone,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Package,
  Building2,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { Destinatario } from "../types"
import { Button } from "@/components/ui/button"

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
    const s = status?.toLowerCase()
    if (s === "entregue") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(22,163,74,0.2)]">
          Entregue
        </span>
      )
    }
    if (s === "em_distribuicao" || s === "em_transito") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--status-info-soft)] text-[var(--status-info)] border border-[rgba(37,99,235,0.2)]">
          Em Distribuição
        </span>
      )
    }
    if (s === "incidencia") {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--status-critical-soft)] text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)]">
          Incidência
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        {status || "Pendente"}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-[var(--surface-bg)] rounded-xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[rgba(18,138,71,0.1)]">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                  {destinatario.name}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <Building2 className="w-3 h-3 mr-1 text-[var(--text-tertiary)]" />
                  {destinatario.client_name}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Histórico e morada de entrega do destinatário
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-[var(--surface-bg)]">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[var(--surface-muted)]/40 border border-[var(--border-subtle)] rounded-md p-3">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                Total de Envios
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {destinatario.total_shipments}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {destinatario.total_shipments === 1 ? "guia" : "guias"}
                </span>
              </div>
            </div>

            <div className="bg-[var(--surface-muted)]/40 border border-[var(--border-subtle)] rounded-md p-3">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                Último Envio
              </span>
              <span className="text-sm font-semibold font-mono text-[var(--text-primary)] mt-1 block">
                {new Date(destinatario.last_shipment_date).toLocaleDateString("pt-PT")}
              </span>
            </div>

            <div className="bg-[var(--surface-muted)]/40 border border-[var(--border-subtle)] rounded-md p-3">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                Último Tracking
              </span>
              <span className="text-xs font-mono font-semibold text-[var(--text-primary)] mt-1 block truncate">
                {destinatario.last_tracking_number}
              </span>
            </div>
          </div>

          {/* Contact and Address Section */}
          <div className="border border-[var(--border-subtle)] rounded-md p-4 bg-[var(--surface-bg)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Morada de Entrega</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="px-2 py-1 h-auto text-[11px] font-medium shadow-2xs"
                >
                  {copiedAddress ? (
                    <Check className="w-3 h-3 mr-1 text-[var(--accent)]" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1 opacity-70" />
                  )}
                  {copiedAddress ? "Copiado" : "Copiar Morada"}
                </Button>

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 border border-[rgba(18,138,71,0.2)] rounded-md transition-colors"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>
            </div>

            <div className="text-xs">
              <p className="font-medium text-[var(--text-primary)]">{destinatario.address}</p>
              <p className="text-[var(--text-secondary)] font-mono text-[11px] mt-0.5">
                {destinatario.postal_code} {destinatario.city} &bull;{" "}
                {destinatario.country === "PT" ? "Portugal" : destinatario.country}
              </p>
            </div>

            {(destinatario.phone || destinatario.email) && (
              <div className="pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap gap-4 text-xs font-mono text-[var(--text-secondary)]">
                {destinatario.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>{destinatario.phone}</span>
                  </div>
                )}
                {destinatario.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>{destinatario.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de Envios */}
          <div className="border border-[var(--border-subtle)] rounded-md overflow-hidden bg-[var(--surface-bg)]">
            <div className="px-4 py-3 bg-[var(--surface-muted)]/50 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                <Package className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>Histórico de Envios ({destinatario.shipments_history.length})</span>
              </div>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] max-h-72 overflow-y-auto">
              {destinatario.shipments_history.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  Sem registos de envios disponíveis.
                </div>
              ) : (
                destinatario.shipments_history.map((item) => (
                  <div
                    key={item.id || item.tracking_number}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                          {item.ctt_object_id || item.tracking_number}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-mono mt-1">
                        <span>{item.service_type || "CTT Expresso"}</span>
                        <span>&bull;</span>
                        <span>{new Date(item.created_at).toLocaleDateString("pt-PT")}</span>
                        {item.sell_price !== undefined && item.sell_price !== null && (
                          <>
                            <span>&bull;</span>
                            <span className="font-medium text-[var(--text-secondary)]">
                              {Number(item.sell_price).toFixed(2)}€
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) =>
                          handleCopyTracking(item.ctt_object_id || item.tracking_number, e)
                        }
                        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                        title="Copiar tracking"
                      >
                        {copiedTrackingId === (item.ctt_object_id || item.tracking_number) ? (
                          <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <Link
                        href={`/ops/envios?search=${encodeURIComponent(
                          item.ctt_object_id || item.tracking_number
                        )}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 border border-[rgba(18,138,71,0.2)] rounded-md transition-colors"
                      >
                        Ver Envio
                        <ArrowRight className="w-3 h-3 opacity-70" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
            {destinatario.shipments_history.length} envio(s) associado(s)
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="px-4 py-1.5 h-auto text-xs font-medium">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
