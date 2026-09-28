import type { Metadata } from 'next'
import { Download, ExternalLink } from 'lucide-react'
import { AndroidMark, GitHubMark, WindowsMark } from '@/components/brand-glyphs'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import {
  ANDROID_BUILD_GUIDE_URL,
  GITHUB_REPO_URL,
  LATEST_RELEASE_URL,
  RELEASES_URL,
  WINDOWS_INSTALLER_URL
} from '@/lib/site-links'

export const metadata: Metadata = {
  title: 'Download Dolphin',
  description: 'Download Dolphin for Windows and build the Android companion app.'
}

export default function DownloadPage() {
  return (
    <>
      <SiteHeader />
      <main className="hero-glow">
        <div className="mx-auto max-w-[1000px] px-6 pt-24 pb-28">
          <h1 className="text-center text-[44px] font-medium leading-none tracking-[-0.03em] text-foreground sm:text-[64px]">
            Download Dolphin
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-center text-[18px] leading-[1.45] text-muted sm:text-[21px]">
            Free and open source. Builds are published on GitHub Releases.
          </p>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            <div id="desktop" className="flex flex-col rounded-2xl border border-line bg-surface p-8">
              <WindowsMark className="size-8 text-accent" />
              <h2 className="mt-6 text-[24px] font-medium text-foreground">Windows</h2>
              <p className="mt-2 flex-1 text-[15px] leading-6 text-muted">
                The Windows installer is not code-signed yet, so SmartScreen may ask you
                to confirm before it runs. The app updates itself from the same releases.
              </p>
              <a
                href={WINDOWS_INSTALLER_URL}
                className="mt-8 flex h-11 items-center justify-center gap-2.5 rounded-lg bg-foreground text-[14.5px] font-medium text-background transition-opacity hover:opacity-90"
              >
                <Download className="size-4" aria-hidden="true" />
                Download dolphin-windows-setup.exe
              </a>
              <a
                href={LATEST_RELEASE_URL}
                className="mt-3 text-center text-[13px] text-muted hover:text-foreground"
              >
                Release notes for the latest version
              </a>
            </div>

            <div id="mobile" className="flex flex-col rounded-2xl border border-line bg-surface p-8">
              <AndroidMark className="size-8 text-[#3ddc84]" />
              <h2 className="mt-6 text-[24px] font-medium text-foreground">Android companion</h2>
              <p className="mt-2 flex-1 text-[15px] leading-6 text-muted">
                Pair your phone with the desktop app to watch agents and send follow-ups. There is no
                published APK yet; build it from source with the mobile guide.
              </p>
              <a
                href={ANDROID_BUILD_GUIDE_URL}
                className="mt-8 flex h-11 items-center justify-center gap-2.5 rounded-lg border border-line-strong text-[14.5px] font-medium text-foreground transition-colors hover:bg-white/5"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Build from source
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[18px] font-medium text-foreground">All releases and source</h2>
              <p className="mt-1 text-[14.5px] text-muted">Every build, checksum, and changelog lives on GitHub.</p>
            </div>
            <div className="flex gap-3">
              <a href={RELEASES_URL} className="flex h-10 items-center rounded-lg border border-line-strong px-4 text-[14px] font-medium text-foreground hover:bg-white/5">
                Releases
              </a>
              <a href={GITHUB_REPO_URL} className="flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-[14px] font-medium text-foreground hover:bg-white/5">
                <GitHubMark className="size-4" />
                Source
              </a>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
