/** Direct NEXT_PUBLIC reads are inlined by Next.js for browser builds. */
export function supabasePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
}
