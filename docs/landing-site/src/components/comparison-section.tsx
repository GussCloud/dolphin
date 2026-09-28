import { Check } from 'lucide-react'

const capabilities: { label: string; others: string }[] = [
  { label: 'Parallel agents, each in its own worktree', others: 'Sometimes' },
  { label: 'Native Windows app with WSL support', others: 'Varies' },
  { label: 'Open source under MIT', others: '—' },
  { label: 'GPU-rendered terminal with splits', others: '—' },
  { label: 'Embedded Chromium with design mode', others: '—' },
  { label: 'Remote worktrees over SSH', others: '—' },
  { label: 'Inline diff comments sent back to the agent', others: 'Limited' },
  { label: 'Any CLI agent, many preconfigured', others: 'One or two' },
  { label: 'CLI so agents can drive the environment', others: '—' },
  { label: 'MCP, hooks, and skills', others: 'Partial' }
]

export function ComparisonSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="grid gap-8 md:grid-cols-2">
          <h2 className="text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[48px]">
            Built for agents,
            <br />
            not retrofitted
          </h2>
          <p className="text-[18px] leading-[1.45] text-muted sm:text-[21px]">
            Editors were built for one person typing. Agent wrappers stop at a terminal. Dolphin is
            the whole environment: worktrees, review, browser, and remote, in one app.
          </p>
        </div>
        <div className="mt-12 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[520px] text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="px-6 py-4 font-normal">Capability</th>
                <th className="w-32 px-4 py-4 text-center font-semibold text-foreground">Dolphin</th>
                <th className="w-40 px-4 py-4 text-center font-normal">IDEs and wrappers</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={capability.label} className="border-b border-line last:border-b-0">
                  <td className="px-6 py-4 text-body">{capability.label}</td>
                  <td className="px-4 py-4 text-center">
                    <Check className="mx-auto size-4 text-accent" aria-label="Yes" />
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] text-subtle">{capability.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
