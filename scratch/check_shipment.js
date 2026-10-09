require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, tracking_number, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}
run()
