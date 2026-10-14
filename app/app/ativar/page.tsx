import type { Metadata } from "next"
import { ClientPasswordForm } from "./ClientPasswordForm"

export const metadata: Metadata = {
  title: "Definir palavra-passe · Linke",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function ClientActivationPage() {
  return <ClientPasswordForm />
}
