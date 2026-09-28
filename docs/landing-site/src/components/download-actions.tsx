import Link from 'next/link'
import { Download } from 'lucide-react'
import { GitHubMark } from '@/components/brand-glyphs'
import { ANDROID_BUILD_GUIDE_URL, GITHUB_REPO_URL, WINDOWS_INSTALLER_URL } from '@/lib/site-links'

type DownloadActionsProps = {
  secondary?: 'github' | 'docs'
}

export function DownloadActions({ secondary = 'github' }: DownloadActionsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={WINDOWS_INSTALLER_URL}
          className="flex h-11 items-center gap-2.5 rounded-lg bg-foreground px-5 text-[14.5px] font-medium text-background transition-opacity hover:opacity-90"
        >
          <Download className="size-4" aria-hidden="true" />
          Download for Windows
        </a>
        {secondary === 'github' ? (
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-2.5 rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-foreground transition-colors hover:bg-white/5"
          >
            <GitHubMark className="size-4" />
            View on GitHub
          </a>
        ) : (
          <Link
            href="/download"
            className="flex h-11 items-center rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-foreground transition-colors hover:bg-white/5"
          >
            All downloads
          </Link>
        )}
      </div>
      <p className="text-[13px] text-muted">
        Also:{' '}
        <a href={ANDROID_BUILD_GUIDE_URL} className="underline-offset-4 hover:text-foreground hover:underline">
          Android companion
        </a>{' '}
        ·{' '}
        <Link href="/download" className="underline-offset-4 hover:text-foreground hover:underline">
          all releases
        </Link>
      </p>
    </div>
  )
}
