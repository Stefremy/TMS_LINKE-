import { Resend } from "resend";

let resendClient: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!resendClient) {
    console.warn("RESEND_API_KEY not configured. Skipping email send to:", to);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.STORE_FROM_EMAIL || "notificacoes@linke.pt";

  try {
    const { data, error } = await resendClient.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
}

/**
 * Helper to replace {{variables}} in an HTML string
 */
export function compileTemplate(htmlTemplate: string, variables: Record<string, string | number>) {
  let compiled = htmlTemplate;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    compiled = compiled.replace(regex, String(value));
  }
  return compiled;
}
