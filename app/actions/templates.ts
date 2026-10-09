"use server"

import { createAdminClient } from "@/lib/supabase/server"

export async function getEmailTemplates() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    console.error("Failed to fetch templates:", error)
    return []
  }
  return data
}

export async function updateEmailTemplate(id: string, html_content: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("email_templates")
    .update({ 
      html_content,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)

  if (error) {
    console.error("Failed to update template:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
