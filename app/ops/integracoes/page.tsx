import * as React from "react"
import { Plug, Key, FileText, CheckCircle2 } from "lucide-react"
import { getIntegrations, saveIntegration } from "@/app/actions/integracoes"
import { SubmitButton } from "./submit-button"

export default async function IntegracoesPage() {
  const integrations = await getIntegrations()
  const cttConfig = integrations.find((i: any) => i.provider === 'CTT')
  const isCttConnected = !!cttConfig?.credentials?.client_id

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Integrações</h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* CTT Integration Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <span className="text-red-600 font-black text-xl tracking-tighter">CTT</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">CTT Expresso</h2>
                <p className="text-sm text-slate-500">Integração oficial via SOAP API</p>
              </div>
            </div>
            <div>
              {isCttConnected ? (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Conectado
                </span>
              ) : (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold">
                  Não Conectado
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            <form action={saveIntegration} className="space-y-6">
              <input type="hidden" name="provider" value="CTT" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Client ID / Username</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      name="client_id" 
                      defaultValue={cttConfig?.credentials?.client_id || ""}
                      placeholder="Ex: USER_LINKE_01" 
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                      required 
                    />
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      name="password" 
                      defaultValue={cttConfig?.credentials?.password || ""}
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                      required 
                    />
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Nº Contrato CTT</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      name="contract_number" 
                      defaultValue={cttConfig?.credentials?.contract_number || ""}
                      placeholder="Ex: 5012345" 
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                      required 
                    />
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>

        {/* Placeholder for future integrations */}
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center">
          <Plug className="w-8 h-8 text-slate-300 mb-3" />
          <h3 className="text-slate-600 font-bold mb-1">Mais integrações em breve</h3>
          <p className="text-slate-500 text-sm">Correos Express, DPD, GLS, etc.</p>
        </div>

      </div>
    </div>
  )
}
