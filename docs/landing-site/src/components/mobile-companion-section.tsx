import { ChevronLeft, Filter, Plus, Search } from 'lucide-react'
import { AndroidMark } from '@/components/brand-glyphs'
import { ANDROID_BUILD_GUIDE_URL, DOCS_URL } from '@/lib/site-links'

const phoneWorktrees = [
  { name: 'feat/mobile-page', meta: 'claude · refactoring mock to use real screens…', state: 'working', pr: '#491' },
  { name: 'runtime/web-pairing', meta: '$ pnpm test --filter web-runtime', state: 'done', pr: '#487' },
  { name: 'infra/notifier', meta: 'awaiting permission · sudo apt install', state: 'blocked' },
  { name: 'docs/styleguide-update', meta: '$ pnpm lint', state: 'done' },
  { name: 'feat/runtime-perf', meta: 'idle', state: 'idle' },
  { name: 'fix/notifier-cooldown', meta: 'codex · investigating notification queue…', state: 'working', pr: '#483' }
] as const

const dotColor = {
  working: 'bg-warning',
  done: 'bg-success',
  blocked: 'bg-danger',
  idle: 'bg-subtle'
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-[288px] rounded-[44px] border border-line-strong bg-[#050a14] p-2.5 shadow-[0_30px_90px_-30px_rgb(6_182_212/0.35)]">
      <div className="h-[590px] overflow-hidden rounded-[36px] bg-[#0a1120] px-3 pt-5">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
          <ChevronLeft className="size-4 text-muted" />
          <span className="size-1.5 rounded-full bg-success" />
          Workstation
        </p>
        <div className="mt-3 flex items-center gap-3 border-b border-line pb-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1"><Filter className="size-3" />Filter</span>
          <span>Recent</span>
          <span>Repo</span>
          <span className="ml-auto flex items-center gap-2"><Plus className="size-3" /><Search className="size-3" /></span>
        </div>
        <p className="mt-3 text-[9.5px] font-semibold tracking-wider text-subtle">PINNED · 3</p>
        <ul className="mt-1 divide-y divide-line">
          {phoneWorktrees.map((worktree, index) => (
            <li key={worktree.name} className="py-2.5">
              {index === 3 ? <p className="mb-2 text-[9.5px] font-semibold tracking-wider text-subtle">ACTIVE</p> : null}
              <p className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground">
                <span className={`size-1.5 rounded-full ${dotColor[worktree.state]}`} />
                {worktree.name}
                {'pr' in worktree ? <span className="rounded bg-white/10 px-1 text-[9px] font-normal text-muted">{worktree.pr}</span> : null}
              </p>
              <p className="mt-0.5 truncate pl-3.5 font-mono text-[9.5px] text-subtle">{worktree.meta}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function MobileCompanionSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 py-24 md:grid-cols-[1.3fr_1fr]">
        <div>
          <h3 className="text-[36px] font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[48px]">
            Keep agents moving
            <br />
            from your phone.
          </h3>
          <p className="mt-6 max-w-[660px] text-[18px] leading-[1.45] text-muted sm:text-[21px]">
            Pair Dolphin with the Android companion app to watch live agent status, check usage,
            and keep terminal work moving when you are away from your desk.
          </p>
          <div className="mt-8 flex max-w-[448px] flex-col gap-2.5">
            <a
              href={ANDROID_BUILD_GUIDE_URL}
              className="flex h-12 items-center justify-center gap-2.5 rounded-lg bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
            >
              <AndroidMark className="size-4.5 text-[#3ddc84]" />
              Android companion
            </a>
            <a
              href={`${DOCS_URL}/mobile`}
              className="flex h-11 items-center justify-center rounded-lg border border-line-strong text-[15px] font-semibold text-foreground transition-colors hover:bg-white/5"
            >
              How pairing works
            </a>
          </div>
        </div>
        <PhoneMockup />
      </div>
    </section>
  )
}
