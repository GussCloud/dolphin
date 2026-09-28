import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import './globals.css'

const siteUrl = 'https://dolphin.guss.dev.br'

export const metadata: Metadata = {
  title: 'Dolphin Docs',
  description: 'Product documentation for Dolphin — the worktree IDE for AI coding agents.',
  metadataBase: new URL(siteUrl),
  applicationName: 'Dolphin Docs',
  icons: {
    icon: '/docs/favicon.ico',
    shortcut: '/docs/favicon.ico'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${siteUrl}/docs`,
    siteName: 'Dolphin',
    title: 'Dolphin Docs',
    description: 'Product documentation for Dolphin — the worktree IDE for AI coding agents.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dolphin Docs',
    description: 'Product documentation for Dolphin — the worktree IDE for AI coding agents.'
  },
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: `${siteUrl}/docs`
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" className="bg-background text-foreground" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <RootProvider search={{ enabled: false }} theme={{ defaultTheme: 'dark' }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
