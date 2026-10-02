"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Receipt, 
  Cloud, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Layers, 
  Tag, 
  Percent, 
  Calendar,
  Building2,
  Check,
  HelpCircle,
  ExternalLink
} from "lucide-react"
import { 
  saveBillingConfigAction, 
  syncMoloniArticleAction 
} from "@/app/actions/billing-config"
import { type BillingConfig } from "@/app/actions/billing-config-types"
import { MoloniConnectModal } from "@/app/ops/faturacao/contas-corrente/MoloniConnectModal"

interface BillingConfigClientProps {
  initialConfig: BillingConfig
  moloniDetails?: any
}

export function BillingConfigClient({ initialConfig, moloniDetails }: BillingConfigClientProps) {
  const router = useRouter()
  const [config, setConfig] = React.useState<BillingConfig>(initialConfig)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [isMoloniModalOpen, setIsMoloniModalOpen] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ message: string; type: "success" | "error" } | null>(null)
  const [syncResult, setSyncResult] = React.useState<{ message: string; type: "success" | "error" } | null>(null)

  const updateConfig = (updates: Partial<BillingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await saveBillingConfigAction(config)
      if (res.success) {
        setHasChanges(false)
        setFeedback({ message: "Configurações de faturação guardadas com sucesso!", type: "success" })
        router.refresh()
      } else {
        setFeedback({ message: res.error || "Falha ao gravar configurações.", type: "error" })
      }
    } catch (err: any) {
      setFeedback({ message: err?.message || "Erro inesperado ao gravar.", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleSyncMoloni = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await syncMoloniArticleAction({
        reference: config.articleReference,
        name: config.articleDesignation,
        summary: config.articleSummary,
      })
      if (res.success) {
        setSyncResult({ message: res.message, type: "success" })
      } else {
        const isAuth = String(res.message || "").toLowerCase().includes("refresh token") || String(res.message || "").toLowerCase().includes("expirada")
        setSyncResult({ 
          message: isAuth 
            ? "A sessão com o Moloni expirou (Token inválido). Clique em 'Gerir Conta Moloni' no topo para voltar a ligar." 
            : res.message, 
          type: "error" 
        })
      }
    } catch (err: any) {
      const isAuth = String(err?.message || "").toLowerCase().includes("refresh token") || String(err?.message || "").toLowerCase().includes("expirada")
      setSyncResult({ 
        message: isAuth 
          ? "A sessão com o Moloni expirou (Token inválido). Clique em 'Gerir Conta Moloni' no topo para voltar a ligar." 
          : (err?.message || "Erro ao comunicar com Moloni."), 
        type: "error" 
      })
    } finally {
      setSyncing(false)
    }
  }

  // Pre-calculated live preview mock line
  const mockTracking = "LTK7219297"
  const mockService = "CTT Expresso 24H"
  const mockWeight = "1kg"
  const mockRecipient = "Ana Beatriz Ramos"
  const mockCity = "Guimarães"

  const previewLineTitle = [
    config.includeTrackingInName ? `Envio ${mockTracking}` : "Envio",
    config.includeServiceNameInName ? `- ${mockService}` : "",
    config.includeWeightInName ? `(Peso: ${mockWeight})` : ""
  ].filter(Boolean).join(" ")

  const previewSummary = [
    config.includeDestinationInSummary ? `Destino: ${mockRecipient}` : "",
    config.includeCityInSummary && config.includeDestinationInSummary ? `(${mockCity})` : "",
  ].filter(Boolean).join(" ")

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Faturação & Moloni</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Parâmetros de faturação, catálogo de artigos e integração com software certificado AT
            </p>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>Configuração</span>
          <span>&gt;</span>
          <span className="text-slate-600 font-semibold">Faturação & Moloni</span>
        </div>
      </div>

      {/* Toolbar / Action Bar */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        {/* Left: Status Pill & Moloni Action */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-2 ${
            moloniDetails?.isConnected 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <span className={`w-2 h-2 rounded-full ${moloniDetails?.isConnected ? "bg-emerald-600 animate-pulse" : "bg-amber-500"}`} />
            {moloniDetails?.isConnected ? `Moloni Ligado (${moloniDetails.companyName || "Empresa"})` : "Moloni Desconectado"}
          </div>

          <button
            type="button"
            onClick={() => setIsMoloniModalOpen(true)}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded font-medium text-xs shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-slate-500" />
            <span>Gerir Conta Moloni</span>
          </button>
        </div>

        {/* Right: Save Button */}
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Alterações por guardar
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold px-4 py-1.5 rounded text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "A Guardar..." : hasChanges ? "Guardar Alterações" : "Configurações Guardadas"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`px-6 py-2.5 border-b text-xs font-semibold flex items-center justify-between ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer font-bold">×</button>
        </div>
      )}

      {/* Moloni Disconnected Warning Alert */}
      {!moloniDetails?.isConnected && (
        <div className="mx-6 mt-4 p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-900">Sessão Moloni Expirada / Desconectada</span>
              <p className="text-[11px] text-amber-700">
                O token de ligação expirou. Clique em &quot;Gerir Conta Moloni&quot; para voltar a ligar a conta com o seu email/palavra-passe ou 1-clique.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMoloniModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-xs rounded transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Voltar a Ligar Conta Moloni</span>
          </button>
        </div>
      )}

      {/* Main Content Body */}
      <div className="p-6 bg-slate-50/40 space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (7 cols): Article & Line Formatting */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Card 1: Artigo no Catálogo Moloni */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-bold text-slate-800">Artigo Padrão no Moloni</h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">Catálogo Fiscal AT</span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Define a referência e a designação do artigo associado às linhas de envio na fatura oficial comunicada à AT.
              </p>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Referência do Artigo (Ref.ª Artigo)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={config.articleReference}
                      onChange={(e) => updateConfig({ articleReference: e.target.value.toUpperCase() })}
                      placeholder="LINKE-TMS"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-2xs"
                    />
                    <div className="flex items-center gap-1">
                      {["LINKE-TMS", "TRANSPORTE", "PORTES"].map((quickRef) => (
                        <button
                          key={quickRef}
                          type="button"
                          onClick={() => updateConfig({ articleReference: quickRef })}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded border transition-colors cursor-pointer ${
                            config.articleReference === quickRef
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs"
                          }`}
                        >
                          {quickRef}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aparece na coluna <strong>"Ref.ª Artigo"</strong> na fatura impressa.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designação / Nome do Artigo no Moloni
                  </label>
                  <input
                    type="text"
                    value={config.articleDesignation}
                    onChange={(e) => updateConfig({ articleDesignation: e.target.value })}
                    placeholder="Serviço de Transporte"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nome do serviço no catálogo do Moloni (ex: <em>Serviço de Transporte</em>, <em>Envios e Logística</em>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resumo Base do Artigo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={config.articleSummary}
                    onChange={(e) => updateConfig({ articleSummary: e.target.value })}
                    placeholder="Deixar em branco para fatura limpa"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dica: Mantenha vazio para que o Moloni <strong>não repita textos desnecessários</strong> na coluna Designação.
                  </p>
                </div>

                {/* Botão Sincronizar com Moloni */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSyncMoloni}
                    disabled={syncing || !moloniDetails?.isConnected}
                    className="px-3.5 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${syncing ? "animate-spin" : ""}`} />
                    <span>{syncing ? "A Sincronizar..." : "Criar / Atualizar Artigo no Moloni"}</span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Cria o artigo no Moloni se ainda não existir
                  </span>
                </div>

                {syncResult && (
                  <div className={`p-3 rounded border text-xs flex items-center gap-2 ${
                    syncResult.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    {syncResult.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                    <span>{syncResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Formatação das Linhas de Envio */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-bold text-slate-800">Formatação das Linhas de Envio</h2>
                </div>
                <span className="text-xs text-slate-400">Detalhes impressos</span>
              </div>

              <p className="text-xs text-slate-500">
                Escolha que campos informativos devem ser incluídos na descrição de cada linha de envio na fatura.
              </p>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Incluir Número de Tracking</span>
                    <p className="text-[11px] text-slate-500">Adiciona o código do envio (ex.: "Envio LTK7219297")</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.includeTrackingInName}
                    onChange={(e) => updateConfig({ includeTrackingInName: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Incluir Nome do Serviço</span>
                    <p className="text-[11px] text-slate-500">Adiciona o tipo de serviço (ex.: "CTT Expresso 24H")</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.includeServiceNameInName}
                    onChange={(e) => updateConfig({ includeServiceNameInName: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Incluir Peso da Encomenda</span>
                    <p className="text-[11px] text-slate-500">Adiciona o peso taxável do envio (ex.: "(Peso: 1kg)")</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.includeWeightInName}
                    onChange={(e) => updateConfig({ includeWeightInName: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Incluir Destinatário no Resumo da Linha</span>
                    <p className="text-[11px] text-slate-500">Mostra "Destino: Nome do Destinatário" logo abaixo da designação</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.includeDestinationInSummary}
                    onChange={(e) => updateConfig({ includeDestinationInSummary: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Incluir Cidade do Destino</span>
                    <p className="text-[11px] text-slate-500">Adiciona a localidade junto ao destinatário (ex.: "(Guimarães)")</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.includeCityInSummary}
                    disabled={!config.includeDestinationInSummary}
                    onChange={(e) => updateConfig({ includeCityInSummary: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer disabled:opacity-40"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Live Invoice Preview & Fiscal Defaults */}
          <div className="lg:col-span-5 space-y-6">

            {/* Card 3: LIVE PREVIEW DA FATURA */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3 sticky top-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-bold text-slate-800">Pré-visualização da Fatura</h2>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Ao Vivo
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Assim é como uma linha de envio será impressa na sua fatura emitida:
              </p>

              {/* Mock Invoice Table */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 text-[11px] font-sans">
                <div className="border-b-2 border-slate-800 pb-1.5 mb-2 grid grid-cols-12 font-bold text-[10px] text-slate-800 uppercase tracking-wider">
                  <div className="col-span-3">Ref.ª Artigo</div>
                  <div className="col-span-6">Designação</div>
                  <div className="col-span-1 text-right">Qtd.</div>
                  <div className="col-span-2 text-right">Preço</div>
                </div>

                {/* Invoice Row Mock */}
                <div className="grid grid-cols-12 py-2 border-b border-slate-100 items-start">
                  <div className="col-span-3 font-mono font-bold text-slate-900">
                    {config.articleReference || "LINKE-TMS"}
                  </div>
                  <div className="col-span-6 pr-2 space-y-0.5">
                    <div className="font-semibold text-slate-900 leading-tight">
                      {previewLineTitle || "Envio"}
                    </div>
                    {config.articleSummary && (
                      <div className="text-[10px] text-slate-400 italic">
                        {config.articleSummary}
                      </div>
                    )}
                    {previewSummary && (
                      <div className="text-[10px] text-slate-500">
                        {previewSummary}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 text-right font-medium text-slate-700">1</div>
                  <div className="col-span-2 text-right font-semibold text-slate-900">4,50€</div>
                </div>

                {/* Subtotal Mock */}
                <div className="pt-3 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Imposto: 23% IVA</span>
                  <span className="font-bold text-slate-900 text-xs">Total: 5,54€</span>
                </div>
              </div>


              {/* Fiscal & Emission Defaults */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-slate-600" />
                  <span>Padrões de Emissão</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Modo Padrão
                    </label>
                    <select
                      value={config.defaultGrouping}
                      onChange={(e) => updateConfig({ defaultGrouping: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 shadow-2xs"
                    >
                      <option value="detailed">Detalhada (1 a 1)</option>
                      <option value="grouped">Agrupada (por serviço)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Taxa IVA Padrão
                    </label>
                    <select
                      value={config.defaultVatRate}
                      onChange={(e) => updateConfig({ defaultVatRate: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 shadow-2xs"
                    >
                      <option value={23}>23% (Continente)</option>
                      <option value={22}>22% (Madeira)</option>
                      <option value={16}>16% (Açores)</option>
                      <option value={0}>0% (Isento / Autoliquidação)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Prazo de Vencimento
                  </label>
                  <select
                    value={config.defaultPaymentDays}
                    onChange={(e) => updateConfig({ defaultPaymentDays: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 shadow-2xs"
                  >
                    <option value={0}>Pronto Pagamento</option>
                    <option value={7}>7 Dias</option>
                    <option value={15}>15 Dias</option>
                    <option value={30}>30 Dias</option>
                    <option value={60}>60 Dias</option>
                    <option value={90}>90 Dias</option>
                  </select>
                </div>

                {moloniDetails?.documentSets && moloniDetails.documentSets.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Série Documental Moloni
                    </label>
                    <select
                      value={config.defaultDocumentSetId || ""}
                      onChange={(e) => updateConfig({ defaultDocumentSetId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded text-slate-900 shadow-2xs"
                    >
                      <option value="">Automático (Série Ativa no Moloni)</option>
                      {moloniDetails.documentSets.map((ds: any) => (
                        <option key={ds.id} value={ds.id}>
                          Série {ds.name} {ds.active ? "(Ativa)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "A Guardar..." : hasChanges ? "Guardar Alterações" : "Configurações Guardadas"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Moloni Modal */}
      <MoloniConnectModal
        isOpen={isMoloniModalOpen}
        onClose={() => setIsMoloniModalOpen(false)}
        config={{
          isConnected: moloniDetails?.isConnected,
          companyName: moloniDetails?.companyName,
          companyId: moloniDetails?.companyId,
        }}
      />
    </div>
  )
}
