import Image from 'next/image'
import { Bot } from 'lucide-react'
import { SUPPORTED_AGENTS } from '@/content/supported-agents'

export function AgentSupportSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
        <h2 className="text-[34px] font-medium leading-none tracking-[-0.025em] text-foreground sm:text-[48px]">
          Bring your own agent / subscription
        </h2>
        <p className="mx-auto mt-6 max-w-[760px] text-[18px] leading-[1.45] text-muted sm:text-[21px]">
          Works with Claude Code, Codex, OpenCode, Grok, and any other agent CLI. Plug in the
          subscriptions you already have and run them side by side in Dolphin.
        </p>
        <ul className="mx-auto mt-12 flex max-w-[980px] flex-wrap justify-center gap-2">
          {SUPPORTED_AGENTS.map((agent) => (
            <li
              key={agent.name}
              className="flex items-center gap-2 rounded-md border border-line bg-white/[0.02] px-3 py-1.5 text-[14px] text-body"
            >
              {agent.icon ? (
                <Image src={agent.icon} alt="" width={14} height={14} className="size-3.5 rounded-sm" />
              ) : (
                <Bot className="size-3.5 text-muted" aria-hidden="true" />
              )}
              {agent.name}
            </li>
          ))}
          <li className="rounded-md border border-dashed border-line-strong px-3 py-1.5 text-[14px] text-muted">
            Any other CLI agent
          </li>
        </ul>
      </div>
    </section>
  )
}
