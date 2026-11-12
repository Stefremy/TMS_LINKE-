import type { SupabaseClient } from "@supabase/supabase-js"
import { emailTemplates } from "@/app/ops/configuracao/notificacoes/templates"

/** Use saved notification edits; keep the built-in template when storage is unavailable. */
export async function storedEmailTemplate(supabase: SupabaseClient, id: string) {
  try {
    const { data } = await supabase.from("email_templates").select("html_content").eq("id", id).maybeSingle()
    return data?.html_content || emailTemplates[id]
  } catch {
    return emailTemplates[id]
  }
}
