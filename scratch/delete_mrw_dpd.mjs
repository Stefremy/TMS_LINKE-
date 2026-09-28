import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)

async function main() {
  const { data, error } = await supabase
    .from('audit_log')
    .delete()
    .in('action', ['fornecedor_data'])
    .or("details->new_data->>id.eq.forn_lk001,details->new_data->>id.eq.forn_lk002")

  if (error) console.error("Error deleting from audit_log:", error)
  else console.log("Deleted from audit_log")

  // If there's an actual fornecedores table:
  const { data: data2, error: err2 } = await supabase
    .from('fornecedores')
    .delete()
    .in('id', ['forn_lk001', 'forn_lk002'])
  
  if (err2) console.error("Error deleting from fornecedores table:", err2)
  else console.log("Deleted from fornecedores table")
}
main()
