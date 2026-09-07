import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TMS LINKE',
  description: 'Sistema de Gestão de Transportes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
