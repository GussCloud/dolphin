'use client'

import { useState, type JSX } from 'react'
import Image from 'next/image'
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  File,
  Folder,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  ListTodo,
  Plus,
  Search,
  Server,
  SquareTerminal,
  Timer,
  X,
  Zap
} from 'lucide-react'

type SceneId = 'fleet' | 'automate' | 'review' | 'git'

const scenes: { id: SceneId; label: string }[] = [
  { id: 'fleet', label: 'Run a fleet of agents' },
  { id: 'automate', label: 'Automate everything' },
  { id: 'review', label: 'Review AI output' },
  { id: 'git', label: 'Git integration' }
]

const agentTabs: Record<SceneId, string[]> = {
  fleet: ['drafting handoff copy', 'summarizing session', 'updating docs/handoff', 'polishing template'],
  automate: ['nightly dependency audit', 'triage new issues'],
  review: ['tighten address validation', 'review: validators.ts'],
  git: ['fix CI checks detail link', 'PR #412 review']
}

const worktreeAgents = [
  { label: 'drafting handoff copy', age: '12m', state: 'working' },
  { label: 'summarizing session co…', age: '1h', state: 'done' },
  { label: 'updating docs/handoff…', age: '2h', state: 'done' },
  { label: 'polishing handoff templ…', age: '3h', state: 'done' }
] as const

const fileTree = [
  { name: '.github', folder: true, depth: 0 },
  { name: 'public', folder: true, depth: 0 },
  { name: 'src', folder: true, depth: 0, open: true },
  { name: 'app', folder: true, depth: 1 },
  { name: 'checkout', folder: true, depth: 1 },
  { name: 'components', folder: true, depth: 1 },
  { name: 'lib', folder: true, depth: 1 },
  { name: 'tests', folder: true, depth: 0 },
  { name: '.gitignore', depth: 0 },
  { name: 'dolphin.yaml', depth: 0 },
  { name: 'next.config.ts', depth: 0 },
  { name: 'package.json', depth: 0 },
  { name: 'pnpm-lock.yaml', depth: 0 },
  { name: 'README.md', depth: 0 }
]

function StatusDot({ state }: { state: 'working' | 'done' | 'idle' | 'blocked' }) {
  if (state === 'working') {
    return <span className="animate-spin-slow inline-block size-2.5 rounded-full border-[1.5px] border-warning border-t-transparent" />
  }
  const color = { done: 'bg-success', idle: 'bg-subtle', blocked: 'bg-danger' }[state]
  return <span className={`inline-block size-2 rounded-full ${color}`} />
}

function MockupSidebar() {
  return (
    <aside className="hidden w-[228px] shrink-0 flex-col border-r border-line bg-[#0a1120] md:flex">
      <div className="flex h-10 items-center gap-2 px-3">
        <Image src="/logo.svg" alt="" width={16} height={16} />
        <span className="text-[12.5px] font-medium text-body">Dolphin</span>
      </div>
      <div className="space-y-0.5 px-2 text-[12.5px] text-body/80">
        <p className="flex items-center gap-2 rounded px-2 py-1"><ListTodo className="size-3.5" />Tasks</p>
        <p className="flex items-center gap-2 rounded px-2 py-1"><Timer className="size-3.5" />Automations</p>
        <p className="flex items-center gap-2 rounded px-2 py-1"><Search className="size-3.5" />Search</p>
      </div>
      <div className="mt-4 flex items-center justify-between px-4 text-[11.5px] text-muted">
        <span>Projects</span>
        <Plus className="size-3.5" />
      </div>
      <div className="mockup-scroll mt-2 flex-1 space-y-1 overflow-hidden px-2 text-[12px]">
        <p className="flex items-center gap-2 px-2 py-1 text-body"><FolderGit2 className="size-3.5 text-accent" />acme-web <span className="text-subtle">4</span></p>
        {['checkout-flow-v2', 'checkout-baseline', 'auth-session-refresh'].map((name, index) => (
          <div key={name} className="px-2 py-1">
            <p className="flex items-center gap-2 text-body">
              <StatusDot state={index === 0 ? 'working' : 'idle'} />
              {name}
            </p>
            <p className="pl-4 text-[10.5px] text-subtle">feature/{name}</p>
          </div>
        ))}
        <p className="mt-2 flex items-center gap-2 px-2 py-1 text-body"><Folder className="size-3.5 text-muted" />acme-internal <span className="text-subtle">4</span></p>
        <div className="rounded-md bg-white/[0.05] px-2 py-1.5">
          <p className="flex items-center gap-2 text-foreground"><StatusDot state="working" />Improve agent handoff</p>
          <p className="pl-4 text-[10.5px] text-subtle">feature/agent-handoff-summary</p>
          <p className="mt-1 flex items-center justify-between pl-4 text-[10.5px] text-subtle">4 agents <ChevronDown className="size-3" /></p>
          <ul className="mt-1 space-y-1 pl-4">
            {worktreeAgents.map((agent) => (
              <li key={agent.label} className="flex items-center gap-2 text-[11px] text-body/80">
                <StatusDot state={agent.state} />
                <span className="flex-1 truncate">{agent.label}</span>
                <span className="text-subtle">{agent.age}</span>
              </li>
            ))}
          </ul>
        </div>
        {['Fix CI checks detail link', 'Webhook retry backoff'].map((name, index) => (
          <div key={name} className="px-2 py-1">
            <p className="flex items-center gap-2 text-body"><StatusDot state={index === 0 ? 'done' : 'idle'} />{name}</p>
          </div>
        ))}
      </div>
      <div className="flex h-8 items-center px-3 text-subtle"><CircleHelp className="size-3.5" /></div>
    </aside>
  )
}

function FleetTranscript() {
  return (
    <div className="space-y-3 font-mono text-[11.5px] leading-[1.55] text-body/85">
      <p><span className="text-foreground">Explored</span><br /><span className="pl-3 text-muted">Search &quot;handoff|summary|next steps&quot; in docs src</span></p>
      <p className="text-foreground">I&apos;m reading the current handoff doc and the latest workspace transcripts to draft clearer copy.</p>
      <p>
        <span className="text-accent">Ran</span> rg -n &quot;handoff|summary&quot; docs src<br />
        <span className="pl-3 text-muted">docs/handoff.md:4: ## Agent handoff summary</span><br />
        <span className="pl-3 text-muted">src/workspaces/summary.ts:42: export function buildHandoffSummary</span>
      </p>
      <p className="text-foreground">I&apos;ll make the summary shorter, add explicit next steps, and keep the release checklist intact.</p>
      <p><span className="text-accent">Ran</span> pnpm test handoff-summary<br /><span className="pl-3 text-success">PASS docs/handoff.test.ts (6)</span></p>
    </div>
  )
}

function AutomateTranscript() {
  return (
    <div className="space-y-3 font-mono text-[11.5px] leading-[1.55] text-body/85">
      <p><span className="text-accent">$</span> dolphin automations create --name &quot;nightly dependency audit&quot; --trigger daily --time 02:00</p>
      <p><span className="text-accent">$</span> dolphin worktree create --name deps-audit --agent claude</p>
      <p className="pl-3 text-success">✓ worktree ready at ~/work/acme/deps-audit</p>
      <p><span className="text-accent">$</span> dolphin terminal send --text &quot;audit outdated deps and open a PR&quot; --enter</p>
      <p className="pl-3 text-muted">agent started · status: working</p>
      <p className="text-foreground">Bumped 7 packages with patch-level changes. Two majors need review; I left them in the PR description.</p>
      <p><span className="text-accent">$</span> dolphin worktree ps</p>
      <p className="pl-3 text-muted">deps-audit   claude   done     PR #418 opened</p>
      <p className="pl-3 text-muted">triage       codex    working  labeling 12 new issues</p>
    </div>
  )
}

function ReviewDiff() {
  const lines = [
    { n: 44, kind: ' ', text: 'export function validateAddress(values: AddressValues) {' },
    { n: 45, kind: '-', text: "  if (!values.country) return true;" },
    { n: 45, kind: '+', text: "  if (!values.country) return { ok: false, field: 'country' };" },
    { n: 46, kind: '+', text: "  if (values.country === 'CA') return validateCanadianPostal(values);" },
    { n: 47, kind: ' ', text: '  return validateZip(values.zip);' }
  ]
  return (
    <div className="font-mono text-[11.5px] leading-[1.7]">
      <p className="mb-2 text-muted">src/checkout/validators.ts <span className="text-success">+8</span> <span className="text-danger">-3</span></p>
      {lines.map((line) => (
        <p
          key={`${line.n}${line.kind}`}
          className={
            line.kind === '+'
              ? 'bg-success/10 text-[#86efac]'
              : line.kind === '-'
                ? 'bg-danger/10 text-[#fca5a5]'
                : 'text-body/80'
          }
        >
          <span className="inline-block w-8 pr-2 text-right text-subtle">{line.n}</span>
          <span className="inline-block w-4 text-subtle">{line.kind}</span>
          {line.text}
        </p>
      ))}
      <div className="my-2 ml-12 rounded-md border border-primary/40 bg-primary/10 p-2 font-sans text-[12px] text-body">
        <p className="text-[11px] font-medium text-accent">Your comment · line 46</p>
        <p>Also cover missing postal code for CA, and add a test for it.</p>
        <p className="mt-1.5 text-[11px] text-muted">3 comments batched · Send to agent ↵</p>
      </div>
    </div>
  )
}

function GitPanel() {
  const pulls = [
    { id: 412, title: 'Fix CI checks detail link', checks: 'passing', state: 'done' },
    { id: 409, title: 'Webhook retry backoff', checks: 'running', state: 'working' },
    { id: 405, title: 'Observability dashboard tiles', checks: 'failing', state: 'blocked' }
  ] as const
  return (
    <div className="space-y-2 text-[12px]">
      <p className="flex items-center gap-2 text-muted"><GitPullRequest className="size-3.5" />Pull requests · acme-web</p>
      {pulls.map((pull) => (
        <div key={pull.id} className="flex items-center gap-3 rounded-md border border-line bg-white/[0.02] px-3 py-2">
          <StatusDot state={pull.state} />
          <span className="text-subtle">#{pull.id}</span>
          <span className="flex-1 text-foreground">{pull.title}</span>
          <span className="text-[11px] text-muted">checks {pull.checks}</span>
          <span className="rounded border border-line-strong px-1.5 py-0.5 text-[10.5px] text-body">Open worktree</span>
        </div>
      ))}
      <p className="pt-2 text-muted">Linear · ACME-231 &quot;Cart rounding regression&quot; → <span className="text-accent">create worktree</span></p>
    </div>
  )
}

const sceneBody: Record<SceneId, () => JSX.Element> = {
  fleet: FleetTranscript,
  automate: AutomateTranscript,
  review: ReviewDiff,
  git: GitPanel
}

function MockupFileTree() {
  return (
    <aside className="hidden w-[210px] shrink-0 border-l border-line bg-[#0a1120] lg:block">
      <div className="flex h-10 items-center justify-between px-3 text-[12px] text-body">
        <span className="font-medium">acme-web</span>
        <GitBranch className="size-3.5 text-muted" />
      </div>
      <ul className="space-y-[3px] px-2 text-[12px] text-body/85">
        {fileTree.map((entry) => (
          <li key={entry.name} className="flex items-center gap-1.5" style={{ paddingLeft: entry.depth * 12 + 4 }}>
            {entry.folder ? (
              <>
                {entry.open ? <ChevronDown className="size-3 text-subtle" /> : <ChevronRight className="size-3 text-subtle" />}
                <Folder className="size-3.5 text-muted" />
              </>
            ) : (
              <>
                <span className="w-3" />
                <File className="size-3.5 text-subtle" />
              </>
            )}
            {entry.name}
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function AppMockup() {
  const [scene, setScene] = useState<SceneId>('fleet')
  const Body = sceneBody[scene]

  return (
    <div className="mx-auto w-full max-w-[1296px]">
      <div className="mx-auto mb-5 flex w-fit max-w-full overflow-x-auto rounded-xl border border-line bg-white/[0.03] p-1" role="tablist" aria-label="Product scenes">
        {scenes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scene === item.id}
            onClick={() => setScene(item.id)}
            className={
              scene === item.id
                ? 'shrink-0 rounded-lg bg-white/10 px-3.5 py-1.5 text-[13.5px] font-medium text-foreground'
                : 'shrink-0 rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-foreground'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line-strong bg-[#08101d] shadow-[0_40px_120px_-30px_rgb(37_99_235/0.45)]">
        <div className="flex h-[560px] md:h-[640px]">
          <MockupSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-10 items-center gap-0.5 overflow-hidden border-b border-line bg-[#0a1120] px-2">
              {agentTabs[scene].map((label, index) => (
                <span
                  key={label}
                  className={
                    index === 0
                      ? 'flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 border-primary bg-white/[0.04] px-3 py-2 text-[12px] text-foreground'
                      : 'flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] text-muted'
                  }
                >
                  <Zap className="size-3 text-accent" />
                  <span className="max-w-[130px] truncate">{label}</span>
                  <X className="size-3 text-subtle" />
                </span>
              ))}
              <Plus className="ml-2 size-3.5 shrink-0 text-subtle" />
            </div>
            <div className="mockup-scroll min-h-0 flex-1 overflow-hidden bg-[#070d18] p-4">
              <Body />
            </div>
            <div className="flex h-7 items-center justify-between border-t border-line bg-[#0a1120] px-3 font-mono text-[10.5px] text-subtle">
              <span>⠋ Working (esc to interrupt)</span>
              <span className="hidden sm:inline">~/work/acme/agent-handoff-summary</span>
            </div>
            <div className="hidden h-[190px] border-t border-line md:flex">
              <div className="flex-1 border-r border-line bg-[#070d18]">
                <p className="flex h-8 items-center gap-1.5 border-b border-line px-3 text-[12px] text-body"><File className="size-3.5 text-muted" />docs/handoff.md</p>
                <div className="p-3 font-mono text-[11px] leading-[1.6] text-body/80">
                  <p className="text-accent"># Agent handoff summary</p>
                  <p className="mt-1 text-foreground">## Next steps</p>
                  <p>1. Review the handoff copy in this doc</p>
                  <p>2. Merge `feature/agent-handoff-summary`</p>
                </div>
              </div>
              <div className="flex-1 bg-[#070d18]">
                <p className="flex h-8 items-center gap-1.5 border-b border-line px-3 text-[12px] text-body"><SquareTerminal className="size-3.5 text-muted" />Terminal 2</p>
                <div className="p-3 font-mono text-[11px] leading-[1.6] text-body/80">
                  <p><span className="text-accent">PS ~/work/acme/handoff-summary&gt;</span> pnpm test handoff</p>
                  <p className="text-success">✓ docs/handoff.test.ts (6)</p>
                  <p className="text-muted">watching docs/handoff.md and src/workspaces/summary.ts</p>
                </div>
              </div>
            </div>
          </div>
          <MockupFileTree />
        </div>
        <div className="flex h-7 items-center justify-between border-t border-line bg-[#0a1120] px-3 text-[11px] text-muted">
          <span className="flex items-center gap-3">
            <span>Claude 58% 5h · 41% wk</span>
            <span className="hidden sm:inline">Codex 52% 5h · 37% wk</span>
          </span>
          <span className="flex items-center gap-1.5 text-success"><Server className="size-3" />SSH Connected</span>
        </div>
      </div>
    </div>
  )
}
