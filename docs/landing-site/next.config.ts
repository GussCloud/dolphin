import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Served as static files by the VPS Caddy (cloud/deploy/dolphin), next to the app's feeds.
  output: 'export',
  images: { unoptimized: true },
  turbopack: {
    root: process.cwd()
  }
}

export default nextConfig
