import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'IAs de Dono',
  description:
    'Plataforma de chat inteligente com especialistas para donos de negócio',
  generator: 'Next.js',
  applicationName: 'IAs de Dono',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
