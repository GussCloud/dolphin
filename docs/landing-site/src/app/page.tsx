import { AgentSupportSection } from '@/components/agent-support-section'
import { AppMockup } from '@/components/app-mockup'
import { ComparisonSection } from '@/components/comparison-section'
import { DevLoopSection } from '@/components/dev-loop-section'
import { DownloadActions } from '@/components/download-actions'
import { FaqSection } from '@/components/faq-section'
import { FeatureGridSection } from '@/components/feature-grid-section'
import { MobileCompanionSection } from '@/components/mobile-companion-section'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero-glow relative">
          <div className="mx-auto max-w-[1200px] px-6 pt-20 text-center sm:pt-24">
            <p className="text-[13px] font-medium tracking-[0.18em] text-accent uppercase">
              Multi-Agent Dev Orchestrator
            </p>
            <h1 className="mx-auto mt-5 max-w-[1024px] text-[44px] font-medium leading-none tracking-[-0.03em] text-foreground sm:text-[72px]">
              Ship 100x with the <span className="brand-gradient-text">agent IDE</span>
            </h1>
            <p className="mx-auto mt-7 max-w-[832px] text-[18px] leading-[1.45] tracking-[-0.01em] text-muted sm:text-[21px]">
              Run Claude Code, Codex, and any other coding agent in parallel, each in its own
              worktree. Terminals, diffs, a browser, and a CLI, in one app built for agents.
            </p>
            <div className="mt-10">
              <DownloadActions />
            </div>
          </div>
          <div className="mt-20 px-4 sm:px-6">
            <AppMockup />
          </div>
        </section>
        <DevLoopSection />
        <AgentSupportSection />
        <MobileCompanionSection />
        <FeatureGridSection />
        <ComparisonSection />
        <FaqSection />
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1200px] px-6 py-28 text-center">
            <h2 className="text-[48px] font-medium leading-none tracking-[-0.03em] text-foreground sm:text-[72px]">
              Get Dolphin
            </h2>
            <p className="mx-auto mt-7 max-w-[560px] text-[18px] leading-[1.45] text-muted sm:text-[21px]">
              Free and open source. Get work done dramatically faster than in any IDE.
            </p>
            <div className="mt-10">
              <DownloadActions />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
