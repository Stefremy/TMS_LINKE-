import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function resetSpecificAvatars() {
  const emails = ['geral@linke.pt', 'clientes@linke.pt', 'stefano.remy@gmail.com']

  for (const email of emails) {
    console.log(`Checking ${email}...`)
    // Get user by email using admin API (actually listUsers with filter or search is not always easy, let's paginate all)
    let page = 1;
    let hasMore = true;
    while(hasMore) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: 1000
      })
      
      if (error || !users || users.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const u of users) {
        if (u.user_metadata?.avatar && u.user_metadata.avatar.length > 500) {
          console.log(`Found massive avatar on ${u.email}, clearing...`)
          const newMeta = { ...u.user_metadata }
          delete newMeta.avatar
          
          await supabase.auth.admin.updateUserById(u.id, {
            user_metadata: newMeta
          })
          console.log(`Cleared for ${u.email}`)
        }
      }
      
      if (users.length < 1000) {
        hasMore = false;
      }
      page++;
    }
  }
}

resetSpecificAvatars()
