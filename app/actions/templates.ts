"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { requireEmployee } from "@/lib/auth/context"
import { emailTemplateCatalog, mergeEmailTemplates } from "@/lib/email/template-catalog"

async function authorize() {
  const ctx = await requireEmployee()
  if (ctx.role !== "admin") throw new Error("Acesso reservado à administração.")
}

export async function getEmailTemplates() {
  await authorize()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    console.error("Failed to fetch templates:", error)
    return mergeEmailTemplates([])
  }
  return mergeEmailTemplates(data || [])
}

export async function updateEmailTemplate(id: string, html_content: string) {
  await authorize()
  const template = emailTemplateCatalog.find(row => row.id === id)
  if (!template || template.readonly) return { success: false, error: "Este modelo é gerido no respetivo fluxo de envio." }
  if (typeof html_content !== "string" || !html_content.trim() || html_content.length > 200000) return { success: false, error: "Indique um template HTML válido." }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("email_templates")
    .upsert({
      id, name: template.name, description: template.description,
      html_content,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error("Failed to update template:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
