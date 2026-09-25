import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function createOpsUsers() {
  const users = [
    { email: 'geral@linke.pt', password: '87r84rd8rF*' },
    { email: 'clientes@linke.pt', password: '87r84rd8rF*' }
  ]

  for (const u of users) {
    console.log(`Creating user: ${u.email}...`)
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        role: 'ops',
        name: u.email.split('@')[0].toUpperCase()
      }
    })

    if (error) {
      console.error(`Error creating ${u.email}:`, error.message)
    } else {
      console.log(`Success: ${u.email} created with ID ${data.user.id}`)
    }
  }
}

createOpsUsers()
