import type { JSX } from 'react'
import { FEATURE_SHOWCASE, type FeatureIllustration } from '@/content/feature-showcase'
import {
  AgentRosterVisual,
  BrowserVisual,
  CliVisual,
  DiffCommentVisual,
  FileDropVisual,
  NotesVisual,
  RemoteHostsVisual,
  SearchPaletteVisual,
  SplitPanesVisual,
  TasksVisual,
  TerminalVisual,
  UsageVisual,
  WorkspacesVisual
} from '@/components/product-illustrations'

const illustrations: Record<FeatureIllustration, () => JSX.Element> = {
  workspaces: WorkspacesVisual,
  terminal: TerminalVisual,
  browser: BrowserVisual,
  tasks: TasksVisual,
  agents: AgentRosterVisual,
  remote: RemoteHostsVisual,
  'file-drop': FileDropVisual,
  'diff-comment': DiffCommentVisual,
  cli: CliVisual,
  search: SearchPaletteVisual,
  usage: UsageVisual,
  notes: NotesVisual,
  split: SplitPanesVisual
}

export function FeatureGridSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <h2 className="text-[34px] font-medium leading-none tracking-[-0.025em] text-foreground sm:text-[48px]">
          Agent-first, end to end.
        </h2>
        <p className="mt-6 max-w-[720px] text-[18px] leading-[1.45] text-muted sm:text-[21px]">
          IDEs were built for you. An ADE is built for you and your agents: worktrees, terminals,
          browser, and CLI in one app.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_SHOWCASE.map((feature) => {
            const Illustration = illustrations[feature.illustration]
            return (
              <article
                key={feature.title}
                className="overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div
                  aria-hidden="true"
                  className="relative h-[232px] overflow-hidden border-b border-line bg-[radial-gradient(120%_90%_at_50%_0%,rgb(37_99_235/0.16),transparent_70%)] p-5"
                >
                  <div className="origin-top-left scale-[0.9] [width:111%]">
                    <Illustration />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="text-[15.5px] font-medium text-foreground">{feature.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-[1.5] text-muted">
                    {feature.description}
                    {feature.commands ? (
                      <>
                        {' '}
                        {feature.commands.map((command, index) => (
                          <span key={command}>
                            <code className="font-mono font-semibold text-body">{command}</code>
                            {index < (feature.commands?.length ?? 0) - 1 ? ', ' : '.'}
                          </span>
                        ))}
                      </>
                    ) : null}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
