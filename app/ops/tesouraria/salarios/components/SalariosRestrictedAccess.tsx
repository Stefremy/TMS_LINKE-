"use client"

import * as React from "react"
import Link from "next/link"
import { ShieldAlert, Lock, ArrowLeft, Users, Key, AlertTriangle } from "lucide-react"

interface SalariosRestrictedAccessProps {
  userEmail?: string
  userName?: string
}

export function SalariosRestrictedAccess({
  userEmail,
  userName,
}: SalariosRestrictedAccessProps) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[var(--surface-bg)] rounded-3xl border border-[var(--border-subtle)] shadow-xl overflow-hidden">
        {/* Warning Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent p-6 border-b border-[var(--border-subtle)] flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--status-warning-soft)] border border-[rgba(217,119,6,0.25)] text-[var(--status-warning)] flex items-center justify-center shrink-0 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)] mb-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Área Confidencial de Tesouraria
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Acesso Restrito: Salários &amp; Vencimentos
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Esta área contém dados confidenciais de remunerações, recibos de vencimento e encargos fiscais da equipa Linke Logistics.
            </p>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* User Session Info Card */}
          <div className="bg-[var(--surface-muted)] rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                Utilizador Atual
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {userName || "Colaborador"}
              </span>
              {userEmail && (
                <span className="text-xs text-[var(--text-secondary)] font-mono block">
                  {userEmail}
                </span>
              )}
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-dim)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] w-fit">
              Sem permissão de folha salarial
            </span>
          </div>

          {/* Explanation Box */}
          <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
              <Key className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--text-primary)] block font-semibold mb-0.5">
                  Permissão Requerida:
                </strong>
                <span>
                  Para consultar ou processar vencimentos, o seu perfil tem de possuir ativa a permissão{" "}
                  <code className="px-1.5 py-0.5 rounded bg-[var(--surface-dim)] text-[var(--accent)] font-semibold font-mono text-[11px]">
                    Gestão de Salários &amp; Vencimentos
                  </code>{" "}
                  ou credenciais de <strong>Super-Administrador</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
              <Users className="w-4 h-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--text-primary)] block font-semibold mb-0.5">
                  Como desbloquear este acesso:
                </strong>
                <span>
                  O Super-Administrador (Stefano) pode gerir e atribuir esta permissão diretamente no módulo de{" "}
                  <strong>Entidades &gt; Colaboradores</strong> através da opção de Credenciais &amp; Permissões.
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link
              href="/ops"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar à Visão Geral
            </Link>

            <Link
              href="/ops/entidades/colaboradores"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Ver Colaboradores
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
