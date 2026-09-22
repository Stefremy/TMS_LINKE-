const stmt: any = {};
const moloniConfig: any = {};
const setOpenActionMenuId: any = {};
const setIsMoloniModalOpen: any = {};
const setIssuedStatement: any = {};
const router: any = {};
const Cloud: any = () => null;

export const Test = () => {
  return (
    <div>
      {/* Emitir no Moloni */}
      {!(stmt.moloni_document_pdf || stmt.moloni_document_id) && (
          <button
            onClick={async (e) => {
              e.stopPropagation()
              setOpenActionMenuId(null)
              if (!moloniConfig?.isConnected) {
                setIsMoloniModalOpen(true)
                return
              }
              const ok = confirm(`Deseja comunicar e emitir a fatura oficial no Moloni para o extrato ${stmt.statement_number}?`)
              if (!ok) return
              
              const { emitMoloniInvoiceForStatementAction } = await import("@/app/actions/moloni")
              const res = await emitMoloniInvoiceForStatementAction(stmt.statement_number || stmt.id)
              if (res.success) {
                const dlUrl = `/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`
                try {
                  const link = document.createElement("a")
                  link.href = dlUrl
                  link.setAttribute("download", `Fatura_Oficial_${stmt.statement_number.replace(/[\/\\]/g, "_")}.pdf`)
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                } catch {}

                setIssuedStatement({
                  statementNumber: stmt.statement_number,
                  url: `/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/pdf`,
                  clientName: stmt.client_name,
                  totalValue: Number(stmt.total_value || 0),
                  moloniPdf: dlUrl
                })
                router.refresh()
              } else {
                alert(`Erro: ${res.error || "Não foi possível emitir no Moloni"}`)
              }
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
          >
            <Cloud className="w-4 h-4 text-blue-500" />
            Emitir Fatura no Moloni
          </button>
      )}
    </div>
  )
}
