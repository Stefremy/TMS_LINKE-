require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase
    .from('shipments')
    .select('recipient_contact_email')
    .limit(1)
    
  if (error) console.error("Error:", error.message)
  else console.log("Success! Columns exist.")
}
run()
