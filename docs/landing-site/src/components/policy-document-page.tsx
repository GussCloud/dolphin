import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import type { PolicyBlock, PolicyDocument } from '@/content/policy-document'

export function policyDocumentMetadata(document: PolicyDocument, path: string): Metadata {
  return {
    title: `${document.title} · Dolphin for Agents`,
    description: document.description,
    alternates: {
      canonical: path,
      languages:
        document.language === 'en'
          ? { en: path, 'pt-BR': document.alternate.href }
          : { en: document.alternate.href, 'pt-BR': path }
    }
  }
}

function PolicyBlockView({ block }: { block: PolicyBlock }) {
  if (block.kind === 'paragraph') {
    return <p className="text-[16px] leading-7 text-body">{block.text}</p>
  }
  if (block.kind === 'list') {
    return (
      <ul className="list-disc space-y-3 pl-5 text-[16px] leading-7 text-body marker:text-subtle">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="flex flex-wrap gap-3">
      {block.items.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="flex h-10 items-center rounded-lg border border-line-strong px-4 text-[14px] font-medium text-foreground hover:bg-white/5"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function PolicyDocumentPage({ document }: { document: PolicyDocument }) {
  return (
    <>
      <SiteHeader />
      <main className="hero-glow" lang={document.language}>
        <article className="mx-auto max-w-[760px] px-4 pt-20 pb-28 sm:px-6">
          <Link
            href={document.alternate.href}
            hrefLang={document.alternate.href.startsWith('/pt-br') ? 'pt-BR' : 'en'}
            className="text-[14px] font-medium text-accent hover:text-foreground"
          >
            {document.alternate.label}
          </Link>
          <h1 className="mt-6 text-[40px] font-medium leading-none tracking-[-0.03em] text-foreground sm:text-[52px]">
            {document.title}
          </h1>
          <p className="mt-4 text-[14px] text-muted">{document.updatedLabel}</p>
          <p className="mt-8 text-[18px] leading-8 text-body">{document.intro}</p>
          {document.sections.map((section) => (
            <section key={section.heading} className="mt-12 space-y-4">
              <h2 className="text-[22px] font-medium text-foreground">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <PolicyBlockView key={index} block={block} />
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
