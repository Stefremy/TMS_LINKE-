"use client"

import * as React from "react"
import { FileText, Download, ChevronDown, ChevronRight, Eye, Calendar, Package } from "lucide-react"

export default function FaturasClient({ statements }: { statements: any[] }) {
  const [expandedStatement, setExpandedStatement] = React.useState<string | null>(null)
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null)

  if (statements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Sem Faturas</h3>
        <p className="text-slate-500 mt-2">Ainda não existem faturas ou extratos emitidos para a sua conta.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 grid grid-cols-12 gap-4 items-center">
        <div className="col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Documento</div>
        <div className="col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</div>
        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor</div>
        <div className="col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</div>
      </div>
      
      <div className="divide-y divide-slate-100">
        {statements.map(stmt => {
          const isExpanded = expandedStatement === stmt.id
          
          return (
            <div key={stmt.id} className="flex flex-col transition-colors hover:bg-slate-50/50">
              <div 
                className="px-6 py-4 grid grid-cols-12 gap-4 items-center cursor-pointer select-none group"
                onClick={() => setExpandedStatement(isExpanded ? null : stmt.id)}
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">
                      {stmt.statement_number}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Package className="w-3 h-3" />
                      {stmt.shipments_count} Envios Faturados
                    </p>
                  </div>
                </div>
                
                <div className="col-span-3 flex items-center gap-2 text-slate-600 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {new Date(stmt.created_at).toLocaleDateString("pt-PT")}
                </div>
                
                <div className="col-span-2 text-right">
                  <p className="font-black text-slate-900 font-mono">
                    {Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
                
                <div className="col-span-3 flex items-center justify-end gap-2">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenActionMenuId(openActionMenuId === stmt.id ? null : stmt.id)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                    >
                      Ações <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {openActionMenuId === stmt.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenActionMenuId(null)
                          }}
                        />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in zoom-in-95 duration-100">
                          {/* Fatura Oficial AT */}
                          {(stmt.moloni_document_pdf || stmt.moloni_document_id) && !stmt.is_pro_forma && (
                            <a 
                              href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`}
                              download={`Fatura_Oficial_AT_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-4 h-4 text-emerald-500" />
                              Descarregar Fatura (AT)
                            </a>
                          )}

                          {/* Recibo */}
                          {stmt.moloni_receipt_pdf ? (
                            <a 
                              href={stmt.moloni_receipt_pdf}
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-4 h-4 text-indigo-500" />
                              Descarregar Recibo
                            </a>
                          ) : (
                            <div 
                              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 cursor-not-allowed" 
                              title="O recibo estará disponível após a fatura ser paga"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-4 h-4" />
                              Recibo (Pendente)
                            </div>
                          )}

                          <div className="h-px bg-slate-100 my-1 mx-2" />

                          {/* Pró-Forma TMS (Nova via proforma-pdf) */}
                          <a 
                            href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/proforma-pdf`}
                            download={`ProForma_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-4 h-4 text-amber-500" />
                            Gerar Pró-Forma (PDF)
                          </a>

                          {/* Extrato Detalhado TMS (Antigo fallback) */}
                          <a 
                            href={`/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/pdf`}
                            download={`Extrato_TMS_${(stmt.statement_number || stmt.id).replace(/[\/\\]/g, "_")}.pdf`}
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-4 h-4 text-slate-400" />
                            Ver Extrato TMS Interno
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="text-slate-400 p-1">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </div>
              
              {isExpanded && stmt.shipments && stmt.shipments.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-6 pb-8 pl-16">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold">Extrato Detalhado - {stmt.statement_number}</span>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                      <div className="bg-slate-50 px-4 py-2 grid grid-cols-12 gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                        <div className="col-span-3">Data</div>
                        <div className="col-span-3">Tracking</div>
                        <div className="col-span-4">Destinatário</div>
                        <div className="col-span-2 text-right">Valor</div>
                      </div>
                      {stmt.shipments.map((s: any) => (
                        <div key={s.id} className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 text-xs">
                          <div className="col-span-3 text-slate-500">
                            {new Date(s.created_at).toLocaleDateString("pt-PT")}
                          </div>
                          <div className="col-span-3 font-medium text-slate-700">
                            {s.tracking_number || s.reference || "N/A"}
                          </div>
                          <div className="col-span-4 text-slate-500 truncate" title={`${s.recipient_name} (${s.recipient_city})`}>
                            {s.recipient_name} <span className="text-slate-400">({s.recipient_city})</span>
                          </div>
                          <div className="col-span-2 text-right font-mono font-bold text-slate-800">
                            {Number(s.sell_price || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total do Extrato</span>
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
