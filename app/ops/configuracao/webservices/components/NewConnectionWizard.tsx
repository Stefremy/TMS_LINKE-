"use client"

import * as React from "react"
import { X, ChevronRight, ChevronDown, Save, Key, Settings, MapPin, Search, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react"
import { testCttConnectionAction, saveCttConnectionAction } from "@/app/actions/ctt"

interface WizardProps {
  onClose: () => void
}

const CONNECTORS = [
  { id: "ctt_expresso", name: "CTT Expresso" },
  { id: "ctt_postal", name: "CTT Postal" },
  { id: "eno", name: "ENOVO TMS" },
  { id: "dpd", name: "DPD" },
  { id: "gls", name: "GLS" },
]

const INTERNAL_SERVICES = ["CTT Múltiplo", "CTT 24H", "CTT 48H"]
const INTERNAL_GOODS = ["Caixa", "Palete", "Rolo"]

interface StepItem {
  num: number
  label: string
  icon: React.ElementType
}

const STEPS: StepItem[] = [
  { num: 1, label: "Dados de Ligação & Teste", icon: Key },
  { num: 2, label: "Mapeamento Serviços", icon: MapPin },
  { num: 3, label: "Tipos de Mercadoria", icon: Settings },
]

export function NewConnectionWizard({ onClose }: WizardProps) {
  const [step, setStep] = React.useState(1)
  const [selectedConnector, setSelectedConnector] = React.useState("ctt_expresso")

  // Form State
  const [credentials, setCredentials] = React.useState({
    contract_number: "",
    client_number: "",
    auth_id: "",
    user_id: "",
    environment: "qa" as "qa" | "production",
    default_subproduct: "ERS 24",
    description: "Integração CTT Expresso",
  })

  // Test Connection State
  const [testState, setTestState] = React.useState<{
    loading: boolean
    status: "idle" | "success" | "error"
    message?: string
  }>({ loading: false, status: "idle" })

  // Save State
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = React.useState<string | null>(null)

  const handleTestConnection = async () => {
    setTestState({ loading: true, status: "idle" })
    try {
      const res = await testCttConnectionAction({
        contract_number: credentials.contract_number || "12345678",
        client_number: credentials.client_number || "10000001",
        auth_id: credentials.auth_id || "00000000-0000-0000-0000-000000000000",
        user_id: credentials.user_id || undefined,
        environment: credentials.environment,
        default_subproduct: credentials.default_subproduct,
      })

      if (res.success) {
        setTestState({ loading: false, status: "success", message: res.message })
      } else {
        setTestState({ loading: false, status: "error", message: res.message })
      }
    } catch (err: any) {
      setTestState({ loading: false, status: "error", message: err.message || "Falha ao testar ligação." })
    }
  }

  const handleSave = async (options?: { closeAfter?: boolean; advanceToNext?: boolean }) => {
    setIsSaving(true)
    setSaveSuccessMessage(null)
    try {
      if (selectedConnector === "ctt_expresso" || selectedConnector === "ctt_postal") {
        await saveCttConnectionAction({
          contract_number: credentials.contract_number,
          client_number: credentials.client_number,
          auth_id: credentials.auth_id,
          user_id: credentials.user_id,
          environment: credentials.environment,
          default_subproduct: credentials.default_subproduct,
          description: credentials.description,
        })
      }
      setSaveSuccessMessage("Dados de ligação gravados com sucesso na base de dados!")
      if (options?.advanceToNext) {
        setStep(prev => Math.min(prev + 1, 3))
      } else if (options?.closeAfter) {
        onClose()
      }
    } catch (err: any) {
      alert("Erro ao gravar ligação: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Nova Ligação Webservices CTT</h2>
            <p className="text-sm text-slate-500 mt-0.5">Configure os parâmetros de comunicação SOAP SGEE V1.8 e RecolhasWS.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex border-b border-slate-200 shrink-0">
          {STEPS.map((s: StepItem) => {
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <button
                type="button"
                key={s.num} 
                onClick={() => setStep(s.num)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors cursor-pointer hover:bg-slate-100/60 ${
                  isCurrent ? "border-green-600 text-green-700 bg-green-50/50" : 
                  isCompleted ? "border-transparent text-slate-700" : 
                  "border-transparent text-slate-400"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isCurrent ? "bg-green-600 text-white" :
                  isCompleted ? "bg-slate-800 text-white" :
                  "bg-slate-200 text-slate-500"
                }`}>
                  {s.num}
                </div>
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          
          {step === 1 && (
            <div className="flex gap-8">
              {/* Left Column: Base Settings */}
              <div className="w-1/3 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-3">Definições Gerais</h3>
                  
                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[13px] font-semibold text-slate-700">Conector</label>
                    <div className="relative">
                      <select 
                        value={selectedConnector}
                        onChange={(e) => setSelectedConnector(e.target.value)}
                        className="w-full appearance-none bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none pr-8"
                      >
                        {CONNECTORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[13px] font-semibold text-slate-700">Ambiente de Operação</label>
                    <select 
                      value={credentials.environment}
                      onChange={(e) => setCredentials({ ...credentials, environment: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      <option value="qa">Ambiente Testes (QA CTT)</option>
                      <option value="production">Ambiente Produção (Live CTT)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className="text-[13px] font-semibold text-slate-700">SubProduto Padrão</label>
                    <select 
                      value={credentials.default_subproduct}
                      onChange={(e) => setCredentials({ ...credentials, default_subproduct: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      <option value="ERS 24">ERS 24 (Entrega 24 Horas)</option>
                      <option value="ERS 48">ERS 48 (Entrega 48 Horas)</option>
                      <option value="D+1">D+1 (Dia Seguinte)</option>
                      <option value="D+2">D+2 (2 Dias)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-slate-700">Canal de Distribuição</label>
                    <input 
                      type="text" 
                      value="99 (EMS CTT Expresso)" 
                      disabled 
                      className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-sm text-slate-500 cursor-not-allowed" 
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Credentials & Options */}
              <div className="w-2/3 flex flex-col gap-4">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">Credenciais Oficiais ({CONNECTORS.find(c => c.id === selectedConnector)?.name})</h3>
                    <button 
                      type="button"
                      onClick={() => setCredentials({
                        contract_number: "12345678",
                        client_number: "10000001",
                        auth_id: "e4a7b512-4c28-48b2-b7e6-123456789abc",
                        user_id: "",
                        environment: "qa",
                        default_subproduct: "ERS 24",
                        description: "CTT Expresso - Homologação",
                      })}
                      className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline"
                    >
                      Preencher Exemplo de Teste
                    </button>
                  </div>

                  {/* Form fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">Nº Contrato (ContractId) *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 12345678"
                        value={credentials.contract_number}
                        onChange={(e) => setCredentials({ ...credentials, contract_number: e.target.value })}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">Nº Cliente (ClientId) *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 10000001"
                        value={credentials.client_number}
                        onChange={(e) => setCredentials({ ...credentials, client_number: e.target.value })}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" 
                      />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">AuthenticationID (GUID CTT) *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 00000000-0000-0000-0000-000000000000"
                        value={credentials.auth_id}
                        onChange={(e) => setCredentials({ ...credentials, auth_id: e.target.value })}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:outline-none" 
                      />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[12px] font-semibold text-slate-600">UserId (GUID Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Identificador opcional de utilizador CTT"
                        value={credentials.user_id}
                        onChange={(e) => setCredentials({ ...credentials, user_id: e.target.value })}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:outline-none" 
                      />
                    </div>
                  </div>

                  {/* Test Connection Button & Result Box */}
                  <div className="mt-2 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-700">Verificação & Gravação de Ligação</div>
                      <div className="text-[11px] text-slate-500">Valide o endpoint SOAP e grave as credenciais da conta CTT.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={testState.loading}
                        onClick={handleTestConnection}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        {testState.loading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            A testar...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            Testar Comunicação
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave({ closeAfter: false })}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            A Gravar...
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            Gravar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {saveSuccessMessage && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <strong>Guardado:</strong> {saveSuccessMessage}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="ml-3 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                      >
                        Configurar Mapeamento <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {testState.status === "success" && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>{testState.message}</div>
                    </div>
                  )}

                  {testState.status === "error" && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>{testState.message}</div>
                    </div>
                  )}

                  <h3 className="font-bold text-slate-800 text-sm mb-3 pt-4 border-t border-slate-100">Comportamentos Operacionais</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Gerar código de barras CTT (FirstObject)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Download automático etiqueta PDF/ZPL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Ativar sincronização de tracking periódica</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                      <span className="text-[13px] font-medium text-slate-700">Fechar guia no manifesto diário</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Matriz de Serviços CTT</h3>
                  <p className="text-[13px] text-slate-500 mt-0.5">Associe os serviços internos ao código do subproduto CTT correspondente.</p>
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Serviço Interno</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Zona Destino</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Escalão Peso</th>
                      <th className="px-4 py-3 font-bold text-slate-700 w-1/4">SubProduto CTT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {INTERNAL_SERVICES.map((srv, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800 align-top" rowSpan={2}>{srv}</td>
                          <td className="px-4 py-2">Portugal Continental</td>
                          <td className="px-4 py-2 text-slate-500">Base (&lt; 30 kg)</td>
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              defaultValue={srv === "CTT 48H" ? "ERS 48" : "ERS 24"} 
                              className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 focus:outline-none" 
                            />
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                          <td className="px-4 py-2 border-l border-slate-100">Espanha / Ilhas</td>
                          <td className="px-4 py-2 text-slate-500">Base (&lt; 30 kg)</td>
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              defaultValue="D+2" 
                              className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 focus:outline-none" 
                            />
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden max-w-3xl mx-auto">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800">Mapeamento de Mercadoria</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">Indique o código externo utilizado pelos CTT para cada tipo de mercadoria.</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {INTERNAL_GOODS.map(g => (
                    <div key={g} className="flex items-center gap-4">
                      <label className="font-semibold text-sm text-slate-700 w-24 text-right">{g}</label>
                      <input 
                        type="text" 
                        defaultValue={g === "Palete" ? "PAL" : "CX"} 
                        className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
          >
            Fechar
          </button>
          
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded transition-colors"
              >
                Anterior
              </button>
            )}
            
            {step === 1 && (
              <>
                <button 
                  type="button"
                  onClick={() => handleSave({ closeAfter: false })}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-green-600" />}
                  Gravar
                </button>
                <button 
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded shadow transition-colors flex items-center gap-1"
                >
                  Seguinte: Mapeamento Serviços
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <button 
                  type="button"
                  onClick={() => handleSave({ closeAfter: true })}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-green-600" />
                  Gravar e Concluir
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded shadow transition-colors flex items-center gap-1"
                >
                  Seguinte: Tipos Mercadoria
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {step === 3 && (
              <button 
                onClick={() => handleSave({ closeAfter: true })}
                disabled={isSaving}
                className="px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    A Gravar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Gravar Ligação CTT
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
