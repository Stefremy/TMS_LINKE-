import {listCreditNotesAction} from '@/app/actions/credit-notes'
import {requirePermission} from '@/lib/auth/context'
import {CreditNotesList} from './components/CreditNotesList'
import {Undo2} from 'lucide-react'
export const dynamic='force-dynamic'
export default async function CreditNotesPage() {
  await requirePermission('Faturação & Contas Correntes')
  const notes=await listCreditNotesAction()
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header className="flex items-center gap-3"><span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-2.5 text-[var(--accent)]"><Undo2 className="h-5 w-5" /></span><div><h1 className="text-xl font-semibold text-[var(--text-primary)]">Notas de Crédito</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Documentos associados às faturas originais · Moloni</p></div></header><CreditNotesList notes={notes} /></div>
}
