"use client"

import * as React from "react"
import { 
  Key, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ExternalLink, 
  Globe, 
  Server, 
  Zap, 
  Sliders, 
  Check, 
  Copy, 
  Loader2, 
  Building2, 
  Radio, 
  HelpCircle,
  Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { saveIntegrationAction, testCarrierConnectionAction, IntegrationConfig } from "@/app/actions/integracoes"

interface IntegracoesClientProps {
  integrations: IntegrationConfig[]
  savedNotification?: boolean
}

export function IntegracoesClient({ integrations, savedNotification }: IntegracoesClientProps) {
  const cttConfig = integrations.find(i => i.provider.toUpperCase() === "CTT")
  const cttCreds = cttConfig?.credentials || {
    client_id: "100032458",
    contract_number: "300330941",
    auth_id: "1d7ad9a9-c7bb-43be-9f57-851d1baafb4b",
    user_id: "cea67efe-b547-4be6-87a7-09d287ccf0f6",
    environment: "production",
    default_subproduct: "EMSF056.01"
  }

  // Form states for CTT
  const [contractNumber, setContractNumber] = React.useState(cttCreds.contract_number || "300330941")
  const [clientId, setClientId] = React.useState(cttCreds.client_id || "100032458")
  const [authId, setAuthId] = React.useState(cttCreds.auth_id || "1d7ad9a9-c7bb-43be-9f57-851d1baafb4b")
  const [userId, setUserId] = React.useState(cttCreds.user_id || "cea67efe-b547-4be6-87a7-09d287ccf0f6")
  const [environment, setEnvironment] = React.useState<"production" | "qa">(cttCreds.environment || "production")
  const [defaultSubproduct, setDefaultSubproduct] = React.useState(cttCreds.default_subproduct || "EMSF056.01")
  
  // UI states
  const [showAuthId, setShowAuthId] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<any | null>(null)
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(savedNotification ? "Credenciais guardadas com sucesso!" : null)
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  const isConnected = !!(clientId && contractNumber && authId)

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setFeedbackMsg(null)

    try {
      const res = await saveIntegrationAction({
        provider: "CTT",
        contract_number: contractNumber,
        client_id: clientId,
        auth_id: authId,
        user_id: userId,
        environment,
        default_subproduct: defaultSubproduct,
        is_active: true
      })

      if (res.success) {
        setFeedbackMsg("Credenciais da CTT Expresso guardadas com sucesso na base de dados!")
        setTimeout(() => setFeedbackMsg(null), 4000)
      } else {
        alert("Erro ao guardar credenciais.")
      }
    } catch (err: any) {
      alert("Erro ao guardar credenciais: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await testCarrierConnectionAction("CTT")
      setTestResult(res)
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "Erro no teste de conectividade."
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      
      {/* Header Area */}
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)] flex items-center justify-center font-bold">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Integrações & Conexões de Transportadoras
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]">
              1 Conexão Ativa
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Gestão segura de credenciais de expedição, recolhas e rastreabilidade automatizada com transportadoras.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="text-xs font-semibold h-9 px-3.5 border-[var(--border-strong)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTesting ? "animate-spin text-[var(--accent)]" : "text-[var(--text-secondary)]"}`} />
            Testar Conexão CTT
          </Button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {feedbackMsg && (
        <div className="p-3.5 bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.25)] rounded-xl text-xs font-semibold text-[var(--status-success)] flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button 
            onClick={() => setFeedbackMsg(null)}
            className="text-[var(--status-success)] hover:opacity-70 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Test Result Banner */}
      {testResult && (
        <div className={`p-4 rounded-xl border text-xs animate-in fade-in flex items-start justify-between ${
          testResult.success 
            ? "bg-[var(--status-success-soft)] border-[rgba(18,138,71,0.25)] text-[var(--status-success)]"
            : "bg-[var(--status-critical-soft)] border-[rgba(220,38,38,0.2)] text-[var(--status-critical)]"
        }`}>
          <div className="flex items-start gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold text-sm block">
                {testResult.success ? "WebServices CTT Operacionais" : "Erro na Comunicação"}
              </span>
              <p className="mt-0.5 text-[11px] opacity-90">
                {testResult.message || testResult.error}
              </p>
              {testResult.endpoint && (
                <div className="flex items-center gap-3 mt-2 text-[10px] font-mono opacity-80">
                  <span>Endpoint: {testResult.endpoint}</span>
                  <span>•</span>
                  <span>Latência: {testResult.latencyMs}ms</span>
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setTestResult(null)}
            className="opacity-70 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid of Carrier Integrations */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* CTT Expresso Card */}
        <div className="bg-[var(--surface-bg)] rounded-xl shadow-2xs border border-[var(--border-subtle)] overflow-hidden transition-all">
          
          {/* Card Header */}
          <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-muted)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white border border-[var(--border-subtle)] flex items-center justify-center p-2 shadow-2xs shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={getCarrierLogo("ctt") || "/logo_transportadoras/ctt_expresso.png"} 
                  alt="CTT Expresso" 
                  className="max-w-full max-h-full object-contain" 
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">CTT Expresso</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.15)] uppercase">
                    Oficial
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Integração nativa via SOAP API V1.8 • Emissão de Guia, ZPL/PDF e Tracking em tempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--status-success-soft)] text-[var(--status-success)] rounded-md text-xs font-bold border border-[rgba(18,138,71,0.15)] uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-success)] animate-pulse"></span>
                  Conectado
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-dim)] text-[var(--text-tertiary)] rounded-md text-xs font-bold uppercase tracking-wide border border-[var(--border-subtle)]">
                  Não Conectado
                </div>
              )}
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-6 flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Nº Contrato CTT */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                    Nº de Contrato CTT <span className="text-[var(--status-critical)]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(contractNumber, "contract")}
                    className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                  >
                    {copiedKey === "contract" ? <Check className="w-3 h-3 text-[var(--status-success)]" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ex: 300330941" 
                    className="w-full pl-9 pr-3 py-2 bg-[var(--canvas-bg)] border border-[var(--border-strong)] rounded-md text-xs font-mono text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--accent)]" 
                    required 
                  />
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)]">Identificador do contrato comercial com a CTT Expresso</span>
              </div>

              {/* Nº Cliente CTT */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                    Nº de Cliente (Client ID) <span className="text-[var(--status-critical)]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(clientId, "client")}
                    className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                  >
                    {copiedKey === "client" ? <Check className="w-3 h-3 text-[var(--status-success)]" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Ex: 100032458" 
                    className="w-full pl-9 pr-3 py-2 bg-[var(--canvas-bg)] border border-[var(--border-strong)] rounded-md text-xs font-mono text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--accent)]" 
                    required 
                  />
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)]">Conta de faturação ou ClientId atribuído pela CTT</span>
              </div>

              {/* Authentication ID (GUID) */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                    Authentication ID (Chave de Acesso GUID) <span className="text-[var(--status-critical)]">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAuthId(!showAuthId)}
                      className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold"
                    >
                      {showAuthId ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showAuthId ? "Ocultar" : "Mostrar Chave"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(authId, "auth")}
                      className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                    >
                      {copiedKey === "auth" ? <Check className="w-3 h-3 text-[var(--status-success)]" /> : <Copy className="w-3 h-3" />}
                      Copiar
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type={showAuthId ? "text" : "password"} 
                    value={authId}
                    onChange={(e) => setAuthId(e.target.value)}
                    placeholder="Ex: 1d7ad9a9-c7bb-43be-9f57-851d1baafb4b" 
                    className="w-full pl-9 pr-10 py-2 bg-[var(--canvas-bg)] border border-[var(--border-strong)] rounded-md text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" 
                    required 
                  />
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)]">GUID de autenticação do WebService CTT (fornecido pela equipa de integração CTT)</span>
              </div>

              {/* User ID (GUID) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                  User ID (Opcional GUID)
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Ex: cea67efe-b547-4be6-87a7-09d287ccf0f6" 
                    className="w-full pl-9 pr-3 py-2 bg-[var(--canvas-bg)] border border-[var(--border-strong)] rounded-md text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" 
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </div>
              </div>

              {/* Ambiente */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                  Ambiente WebService
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as "production" | "qa")}
                  className="w-full px-3 py-2 bg-[var(--canvas-bg)] border border-[var(--border-strong)] rounded-md text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="production">Produção Oficial (cttexpressows.ctt.pt)</option>
                  <option value="qa">Ambiente de Testes / Sandbox (cttexpressows.qa.ctt.pt)</option>
                </select>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {environment === "production" 
                    ? "Os envios emitem etiquetas reais e acionam recolhas operacionais" 
                    : "Modo simulador para validação de layout de etiquetas"}
                </span>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Canal de Distribuição: <strong>99 (EMS)</strong> • Subproduto: <strong>{defaultSubproduct}</strong></span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-2xs"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Guardar Configuração CTT
                </Button>
              </div>
            </div>

          </form>

        </div>

        {/* Other Multi-Carrier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Correos Express */}
          <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col justify-between shadow-2xs opacity-90 hover:opacity-100 transition-opacity">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-[var(--border-subtle)] flex items-center justify-center p-1.5 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={getCarrierLogo("correos_express") || "/logo_transportadoras/correos_express.png"} 
                    alt="Correos Express" 
                    className="max-w-full max-h-full object-contain" 
                  />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  Disponível
                </span>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Correos Express</h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Integração REST API para envios ibéricos Paq 24 / Paq 14.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-[var(--border-subtle)]">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold h-8"
                onClick={() => alert("A integração com Correos Express pode ser ativada mediante fornecimento do código de cliente.")}
              >
                Configurar Conexão
              </Button>
            </div>
          </div>

          {/* DPD Portugal */}
          <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 flex flex-col justify-between shadow-2xs opacity-90 hover:opacity-100 transition-opacity">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-[var(--border-subtle)] flex items-center justify-center p-1.5 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={getCarrierLogo("dpd") || "/logo_transportadoras/dpd.png"} 
                    alt="DPD Portugal" 
                    className="max-w-full max-h-full object-contain" 
                  />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  Disponível
                </span>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">DPD Portugal</h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Conexão Predict & DPD Classic com geração de etiquetas GeoPost.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-[var(--border-subtle)]">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold h-8"
                onClick={() => alert("A integração com DPD está pronta para configuração de credenciais GeoPost.")}
              >
                Configurar Conexão
              </Button>
            </div>
          </div>

          {/* DHL Parcel / GLS */}
          <div className="bg-[var(--surface-muted)] rounded-xl border border-dashed border-[var(--border-strong)] p-5 flex flex-col justify-between text-center items-center">
            <div className="my-auto py-2">
              <Truck className="w-7 h-7 text-[var(--text-tertiary)] mx-auto mb-2 opacity-60" />
              <h3 className="text-xs font-bold text-[var(--text-primary)]">Outros Transportadores</h3>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                DHL Parcel, GLS, VASP & Rangel
              </p>
            </div>
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Roadmap Q4 2026
            </span>
          </div>

        </div>

      </div>

    </div>
  )
}
