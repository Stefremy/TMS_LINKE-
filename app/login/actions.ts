'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  try {
    console.log("Login action triggered with email:", formData.get('email'))
    const supabase = await createClient()

    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const { data: { user }, error } = await supabase.auth.signInWithPassword(data)
    
    console.log("Supabase response:", { user: user?.email, error: error?.message })

    if (error || !user) {
      console.log("Redirecting to login with error")
      redirect('/login?error=true')
    }

    revalidatePath('/', 'layout')
    
    if (user.user_metadata?.role === 'client') {
      redirect('/app')
    } else {
      redirect('/ops')
    }
  } catch (err) {
    console.error("Login Server Action Error:", err)
    // Next.js redirect() throws a specific error, we MUST rethrow it!
    if (err && typeof err === 'object' && 'digest' in err && (err as any).digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    // For other errors, redirect to error state
    redirect('/login?error=true')
  }
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
