import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#128a47',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_ORIGIN || process.env.OPS_ORIGIN || process.env.CLIENT_PORTAL_ORIGIN || 'http://localhost:3000'),
  title: 'TMS LINKE',
  description: 'Sistema de Gestão de Transportes',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Linke',
    title: 'TMS LINKE',
    description: 'Sistema de Gestão de Transportes',
    images: [{ url: '/linke-social.png', width: 1200, height: 630, alt: 'Linke — conexões que transformam' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TMS LINKE',
    description: 'Sistema de Gestão de Transportes',
    images: ['/linke-social.png'],
  },
  icons: {
    icon: '/favicon.png?v=2',
    shortcut: '/favicon.png?v=2',
    apple: '/favicon.png?v=2',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
