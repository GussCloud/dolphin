import Image from 'next/image'
import { Bot, FileText, Globe, ImageIcon, MousePointerClick, Search, Server, SquareTerminal } from 'lucide-react'
import { SUPPORTED_AGENTS } from '@/content/supported-agents'

function Spinner() {
  return <span className="animate-spin-slow inline-block size-2.5 shrink-0 rounded-full border-[1.5px] border-warning border-t-transparent" />
}

function PendingBar({ width }: { width: string }) {
  return <span className="animate-pulse-bar block h-1.5 rounded-full bg-white/15" style={{ width }} />
}

export function WorkspacesVisual() {
  const toolRow = (tool: string, argument: string) => (
    <>
      <span className="text-muted">{tool}</span>{' '}
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-foreground">{argument}</code>
    </>
  )
  const worktrees = [
    { name: 'speed up CI pipeline', rows: [toolRow('Bash', 'pnpm test auth'), <PendingBar key="bar" width="75%" />] },
    { name: 'set up dolphin.yaml', rows: [<span key="text" className="text-muted">Looking at the session middleware now…</span>], active: true },
    { name: 'fix login race condition', rows: [toolRow('Read', 'routes/login.ts'), <PendingBar key="bar-1" width="72%" />, <PendingBar key="bar-2" width="80%" />] }
  ]
  return (
    <div className="space-y-2 rounded-xl border border-line bg-background/60 p-3">
      {worktrees.map((worktree) => (
        <div key={worktree.name} className={worktree.active ? 'rounded-lg border border-line-strong bg-white/[0.04] p-3' : 'rounded-lg bg-white/[0.02] p-3'}>
          <p className="flex items-center gap-2.5 text-[14.5px] font-medium text-foreground">
            <span className="size-2 rounded-full bg-success" />
            {worktree.name}
          </p>
          <div className="mt-2 space-y-2.5 pl-5">
            {worktree.rows.map((row, index) => (
              <div key={index} className="flex items-center gap-3 text-[13px]">
                <Spinner />
                <div className="flex-1">{row}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrchestrationVisual() {
  const workers = [
    { role: 'planner', agent: 'Claude Code', status: 'done', note: 'split task into 3 worktrees' },
    { role: 'writer', agent: 'Codex', status: 'working', note: 'implementing retry backoff' },
    { role: 'writer', agent: 'OpenCode', status: 'working', note: 'adding webhook tests' },
    { role: 'reviewer', agent: 'Gemini', status: 'waiting', note: 'waiting for worker_done' }
  ]
  return (
    <div className="rounded-xl border border-line bg-background/60 p-4 font-mono text-[12.5px]">
      <p className="mb-3 text-muted">$ dolphin worktree ps</p>
      {workers.map((worker) => (
        <p key={worker.agent} className="grid grid-cols-[80px_110px_80px_1fr] gap-2 py-1 text-body/85">
          <span className="text-accent">{worker.role}</span>
          <span className="text-foreground">{worker.agent}</span>
          <span className={worker.status === 'done' ? 'text-success' : worker.status === 'working' ? 'text-warning' : 'text-muted'}>{worker.status}</span>
          <span className="truncate text-muted">{worker.note}</span>
        </p>
      ))}
    </div>
  )
}

export function BrowserVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-background/60">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] text-muted">
        <Globe className="size-3.5" /> localhost:3000/checkout
      </div>
      <div className="relative space-y-3 p-5">
        <div className="h-4 w-40 rounded bg-white/15" />
        <div className="h-3 w-64 rounded bg-white/10" />
        <div className="relative w-fit rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white outline outline-2 outline-offset-4 outline-accent">
          Place order
          <MousePointerClick className="absolute -right-5 -bottom-4 size-5 text-foreground" />
        </div>
        <div className="mt-6 rounded-md border border-accent/40 bg-accent/10 p-3 text-[12.5px] text-body">
          <p className="font-medium text-accent">Sent to agent</p>
          <p className="text-muted">&lt;button class=&quot;btn-primary&quot;&gt; · styles · cropped screenshot</p>
        </div>
      </div>
    </div>
  )
}

export function TerminalVisual() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line font-mono text-[12px]">
      {[
        ['PS> pnpm dev', '▲ Next.js ready on :3000'],
        ['PS> claude', '● Editing src/cart.ts'],
        ['$ ssh build-box', 'connected · 16 cores'],
        ['PS> pnpm test --watch', '✓ 142 passed']
      ].map(([command, output]) => (
        <div key={command} className="bg-[#070d18] p-3">
          <p className="text-accent">{command}</p>
          <p className="text-body/80">{output}</p>
        </div>
      ))}
    </div>
  )
}

export function TasksVisual() {
  const tasks = [
    { id: '#231', title: 'Cart rounding regression', source: 'Linear' },
    { id: '#412', title: 'Fix CI checks detail link', source: 'GitHub' },
    { id: '#409', title: 'Webhook retry backoff', source: 'GitHub' }
  ]
  return (
    <div className="space-y-2 rounded-xl border border-line bg-background/60 p-3">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-[13.5px]">
          <span className="text-subtle">{task.id}</span>
          <span className="flex-1 text-foreground">{task.title}</span>
          <span className="text-[12px] text-muted">{task.source}</span>
          <span className="rounded-md border border-line-strong px-2 py-0.5 text-[12px] text-body">Start worktree</span>
        </div>
      ))}
    </div>
  )
}

export function EditorVisual() {
  return (
    <div className="rounded-xl border border-line bg-[#070d18] p-4 font-mono text-[12.5px] leading-[1.7]">
      <p className="text-muted">src/checkout/validators.ts</p>
      <p><span className="text-[#c084fc]">export function</span> <span className="text-accent">validateAddress</span>(values) {'{'}</p>
      <p className="pl-4"><span className="text-[#c084fc]">if</span> (!values.country) <span className="text-[#c084fc]">return</span> {'{'} ok: <span className="text-warning">false</span> {'}'}</p>
      <p className="pl-4"><span className="text-[#c084fc]">return</span> validateZip(values.zip)</p>
      <p>{'}'}</p>
    </div>
  )
}

export function NotesVisual() {
  return (
    <div className="rounded-xl border border-line bg-background/60 p-5 text-[13.5px] leading-6">
      <p className="text-[16px] font-semibold text-foreground">Release notes draft</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body/85">
        <li>Handoff summaries now include next steps</li>
        <li>Webhook retries back off exponentially</li>
        <li className="text-muted">Ask the agent to link each PR</li>
      </ul>
    </div>
  )
}

export function ShipVisual() {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-background/60 p-4 text-[13.5px]">
      <p className="font-medium text-foreground">PR #412 · Fix CI checks detail link</p>
      {['typecheck', 'unit tests', 'e2e'].map((check) => (
        <p key={check} className="flex items-center gap-2 text-body/85"><span className="size-2 rounded-full bg-success" />{check}</p>
      ))}
      <p className="pt-1 text-muted">No conflicts · ready to merge</p>
    </div>
  )
}

export function AgentRosterVisual() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SUPPORTED_AGENTS.slice(0, 9).map((agent) => (
        <div key={agent.name} className="flex items-center gap-2 rounded-md border border-line bg-white/[0.03] px-2.5 py-2 text-[12px] text-body">
          {agent.icon ? (
            <Image src={agent.icon} alt="" width={14} height={14} className="size-3.5 rounded-sm" />
          ) : (
            <Bot className="size-3.5 text-muted" aria-hidden="true" />
          )}
          <span className="truncate">{agent.name}</span>
        </div>
      ))}
    </div>
  )
}

export function RemoteHostsVisual() {
  const hosts = [
    { name: 'build-box', kind: 'SSH', detail: 'dev@10.0.0.12 · port 3000 forwarded', online: true },
    { name: 'Ubuntu-24.04', kind: 'WSL', detail: '~/work/acme · git 2.43', online: true },
    { name: 'gpu-runner', kind: 'SSH', detail: 'reconnecting…', online: false }
  ]
  return (
    <div className="space-y-2">
      {hosts.map((host) => (
        <div key={host.name} className="flex items-center gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-[13px]">
          <Server className="size-4 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground">{host.name}</p>
            <p className="truncate font-mono text-[11px] text-subtle">{host.detail}</p>
          </div>
          <span className="rounded border border-line-strong px-1.5 text-[10.5px] text-muted">{host.kind}</span>
          <span className={host.online ? 'size-2 rounded-full bg-success' : 'size-2 rounded-full bg-warning'} />
        </div>
      ))}
    </div>
  )
}

export function FileDropVisual() {
  return (
    <div className="rounded-xl border border-dashed border-accent/50 bg-accent/5 p-4">
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[12px] text-foreground"><FileText className="size-3.5" />src/cart.ts</span>
        <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[12px] text-foreground"><ImageIcon className="size-3.5" />checkout-bug.png</span>
      </div>
      <p className="mt-3 font-mono text-[12.5px] text-body">› fix the rounding shown in the screenshot<span className="animate-pulse-bar">▍</span></p>
      <p className="mt-2 text-[11.5px] text-muted">Drop files or images into the prompt</p>
    </div>
  )
}

export function DiffCommentVisual() {
  return (
    <div className="rounded-xl border border-line bg-[#070d18] p-3 font-mono text-[11.5px] leading-[1.7]">
      <p className="bg-danger/10 px-2 text-[#fca5a5]">- if (!values.country) return true;</p>
      <p className="bg-success/10 px-2 text-[#86efac]">+ if (!values.country) return {'{'} ok: false {'}'};</p>
      <div className="mt-2 rounded-md border border-primary/40 bg-primary/10 p-2 font-sans text-[12px] text-body">
        <p className="text-[11px] font-medium text-accent">Comment · line 46</p>
        <p>Also cover missing postal codes.</p>
      </div>
    </div>
  )
}

export function CliVisual() {
  return (
    <div className="rounded-xl border border-line bg-[#070d18] p-4 font-mono text-[12px] leading-[1.7] text-body/85">
      <p><span className="text-accent">$</span> dolphin worktree create --name fix-cart</p>
      <p className="text-success">✓ worktree ready</p>
      <p><span className="text-accent">$</span> dolphin goto --url http://localhost:3000</p>
      <p><span className="text-accent">$</span> dolphin snapshot</p>
      <p className="text-muted">@e3 button &quot;Place order&quot;</p>
      <p><span className="text-accent">$</span> dolphin click --element @e3</p>
    </div>
  )
}

export function SearchPaletteVisual() {
  const results = ['checkout-flow-v2', 'auth-session-refresh', 'src/checkout/validators.ts', 'claude · drafting handoff copy']
  return (
    <div className="rounded-xl border border-line-strong bg-surface-raised p-2">
      <p className="flex items-center gap-2 border-b border-line px-2 pb-2 text-[13px] text-muted"><Search className="size-3.5" />Jump to worktree, file, or agent…</p>
      <ul className="mt-1 space-y-0.5 text-[12.5px]">
        {results.map((result, index) => (
          <li key={result} className={index === 0 ? 'rounded-md bg-white/10 px-2 py-1.5 text-foreground' : 'px-2 py-1.5 text-body/80'}>{result}</li>
        ))}
      </ul>
    </div>
  )
}

export function UsageVisual() {
  const meters = [
    { label: 'Claude · session', value: 58 },
    { label: 'Claude · weekly', value: 41 },
    { label: 'Codex · session', value: 52 }
  ]
  return (
    <div className="space-y-3 rounded-xl border border-line bg-background/60 p-4">
      {meters.map((meter) => (
        <div key={meter.label}>
          <p className="flex justify-between text-[12px] text-body"><span>{meter.label}</span><span className="text-muted">{meter.value}% used</span></p>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${meter.value}%` }} />
          </div>
        </div>
      ))}
      <p className="text-[11.5px] text-muted">Codex account · switch without re-logging in</p>
    </div>
  )
}

export function SplitPanesVisual() {
  return (
    <div className="grid h-[150px] grid-cols-3 grid-rows-2 gap-1.5">
      <div className="row-span-2 flex items-start gap-1.5 rounded-md border border-line bg-white/[0.03] p-2 text-[11px] text-body"><Bot className="size-3.5 text-accent" />agent</div>
      <div className="flex items-start gap-1.5 rounded-md border border-line bg-white/[0.03] p-2 text-[11px] text-body"><SquareTerminal className="size-3.5 text-muted" />terminal</div>
      <div className="flex items-start gap-1.5 rounded-md border border-line bg-white/[0.03] p-2 text-[11px] text-body"><Globe className="size-3.5 text-muted" />browser</div>
      <div className="col-span-2 flex items-start gap-1.5 rounded-md border border-line bg-white/[0.03] p-2 text-[11px] text-body"><FileText className="size-3.5 text-muted" />diff · validators.ts</div>
    </div>
  )
}
