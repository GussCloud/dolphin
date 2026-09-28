import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

const siteUrl = 'https://dolphin.guss.dev.br'
const description =
  'Run Claude Code, Codex, and any other coding agent in parallel, each in its own worktree. Terminals, diffs, a browser, and a CLI, in one app built for agents.'

export const metadata: Metadata = {
  title: 'Dolphin — Multi-Agent Dev Orchestrator',
  description,
  metadataBase: new URL(siteUrl),
  applicationName: 'Dolphin',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Dolphin',
    title: 'Dolphin — Multi-Agent Dev Orchestrator',
    description
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dolphin — Multi-Agent Dev Orchestrator',
    description
  },
  alternates: {
    canonical: siteUrl
  }
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
