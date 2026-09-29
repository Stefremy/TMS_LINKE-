import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rcifuhiwemwlatgserva.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0'
)

const REFRESH_TOKEN = '6b8587e38fdbf0039866c755dbfd64cfc2431582'
const CLIENT_ID = '518600300'
const CLIENT_SECRET = '0b78b0aef4abfc92960a0c9d97dbe9b7abd8b325'
const COMPANY_ID = '393993'

async function getMoloniToken() {
  const params = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN })
  const res = await fetch(`https://api.moloni.pt/v1/grant/?grant_type=refresh_token&${params}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

async function getDocumentNumber(token, documentId) {
  const params = new URLSearchParams({ access_token: token, json: 'true' })
  const res = await fetch(`https://api.moloni.pt/v1/documents/getOne/?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: Number(COMPANY_ID), document_id: documentId })
  })
  const data = await res.json()
  return data?.number || null
}

async function main() {
  console.log('A obter extratos sem número FT...')
  const { data } = await supabase
    .from('audit_log')
    .select('id, details')
    .eq('action', 'billing_statement')
    .order('created_at', { ascending: false })

  const needsBackfill = data.filter(d =>
    d.details?.moloni_document_id &&
    !d.details?.moloni_document_number &&
    !d.details?.is_pro_forma
  )

  console.log(`Total extratos: ${data.length} | A fazer backfill: ${needsBackfill.length}`)
  if (needsBackfill.length === 0) { console.log('Nada a fazer!'); return }

  const token = await getMoloniToken()
  console.log('Token Moloni obtido ✓')

  for (const row of needsBackfill) {
    const docId = row.details.moloni_document_id
    try {
      const ftNumber = await getDocumentNumber(token, docId)
      if (ftNumber) {
        await supabase
          .from('audit_log')
          .update({ details: { ...row.details, moloni_document_number: ftNumber } })
          .eq('id', row.id)
        console.log(`✓ ${row.details.statement_number} → ${ftNumber}`)
      } else {
        console.log(`⚠ ${row.details.statement_number} → sem número (doc ID: ${docId})`)
      }
    } catch (e) {
      console.log(`✗ ${row.details.statement_number} → ERRO: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }
  console.log('\nBackfill concluído!')
}

main().catch(console.error)
