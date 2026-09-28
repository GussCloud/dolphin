import Image from 'next/image'
import Link from 'next/link'
import { DOCS_URL, GITHUB_REPO_URL, ISSUES_URL, LICENSE_URL, RELEASES_URL } from '@/lib/site-links'

const footerColumns = [
  {
    heading: 'Product',
    links: [
      { label: 'Download', href: '/download' },
      { label: 'Changelog', href: RELEASES_URL },
      { label: 'Docs', href: DOCS_URL }
    ]
  },
  {
    heading: 'Community',
    links: [
      { label: 'GitHub', href: GITHUB_REPO_URL },
      { label: 'Issues', href: ISSUES_URL }
    ]
  },
  {
    heading: 'Legal',
    links: [{ label: 'MIT License', href: LICENSE_URL }]
  }
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-12">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              <span className="text-[15px] font-semibold text-foreground">Dolphin</span>
            </Link>
            <p className="mt-6 text-[14.5px] leading-6 text-muted">
              The multi-agent dev orchestrator. Free and open source for Windows, with an Android
              companion app.
            </p>
          </div>
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h4 className="text-sm font-semibold text-foreground">{column.heading}</h4>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[14.5px] text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-8 text-[13.5px] text-muted sm:flex-row sm:justify-between">
          <p>© 2026 Dolphin. Released under the MIT License.</p>
          <p>Multi-Agent Dev Orchestrator.</p>
        </div>
      </div>
    </footer>
  )
}
