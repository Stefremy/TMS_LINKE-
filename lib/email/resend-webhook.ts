import "server-only"
import { Resend } from "resend"

/** Verification must receive the exact bytes signed by Resend. */
export function verifyResendWebhook(body: string, headers: Headers, secret: string): Record<string, unknown> {
  const id = headers.get("svix-id")
  const timestamp = headers.get("svix-timestamp")
  const signature = headers.get("svix-signature")
  if (!id || !timestamp || !signature) throw new Error("Missing webhook signature")
  const resend = new Resend(process.env.RESEND_API_KEY || "verification-only")
  return resend.webhooks.verify({ payload: body, headers: { id, timestamp, signature }, webhookSecret: secret }) as unknown as Record<string, unknown>
}
