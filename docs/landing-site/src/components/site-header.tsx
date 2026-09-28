import Image from 'next/image'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { GitHubMark } from '@/components/brand-glyphs'
import { formatStars, getGithubStars } from '@/lib/github-stars'
import { DOCS_URL, GITHUB_REPO_URL, RELEASES_URL } from '@/lib/site-links'

const navLinks = [
  { label: 'Docs', href: DOCS_URL },
  { label: 'Changelog', href: RELEASES_URL },
  { label: 'Download', href: '/download' }
]

export async function SiteHeader() {
  const stars = await getGithubStars()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Dolphin home" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={30} height={30} priority />
            <span className="text-[15px] font-semibold tracking-tight text-foreground">Dolphin</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-body/85 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={stars === undefined ? 'Dolphin on GitHub' : `Dolphin on GitHub, ${stars} stars`}
            className="flex items-center gap-1.5 text-sm font-medium text-body/85 transition-colors hover:text-foreground"
          >
            <GitHubMark className="size-4" />
            {stars ? <span>{formatStars(stars)}</span> : null}
          </a>
          <Link
            href="/download"
            className="flex h-8 items-center gap-2 rounded-md bg-foreground px-3.5 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </Link>
        </div>
      </div>
    </header>
  )
}
