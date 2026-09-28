'use client'

import { useState, type JSX } from 'react'
import { Code2, Globe, Layers, ListChecks, NotebookPen, Rocket, SquareTerminal, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  BrowserVisual,
  EditorVisual,
  NotesVisual,
  OrchestrationVisual,
  ShipVisual,
  TasksVisual,
  TerminalVisual,
  WorkspacesVisual
} from '@/components/product-illustrations'

type DevLoopTab = {
  id: string
  label: string
  icon: LucideIcon
  title: string
  description: string
  Visual: () => JSX.Element
}

const tabs: DevLoopTab[] = [
  { id: 'workspaces', label: 'Workspaces', icon: Layers, title: 'Workspaces', description: 'Quickly split tasks into isolated environments, so multiple agents can work side by side without interfering with each other.', Visual: WorkspacesVisual },
  { id: 'orchestration', label: 'Orchestration', icon: Workflow, title: 'Orchestration', description: 'Give each worker one clear goal. Writers get worktrees, reviewers read only, and one owner integrates and tests the result.', Visual: OrchestrationVisual },
  { id: 'browser', label: 'Browser', icon: Globe, title: 'Browser', description: 'A real Chromium window per worktree. Click any element to send its HTML, CSS, and a cropped screenshot to your agent.', Visual: BrowserVisual },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, title: 'Terminal', description: 'GPU-rendered terminals with unlimited splits. PowerShell, Git Bash, WSL, or SSH, side by side.', Visual: TerminalVisual },
  { id: 'tasks', label: 'Tasks', icon: ListChecks, title: 'Tasks', description: 'Pull issues from GitHub and Linear, and start a worktree from any of them in one click.', Visual: TasksVisual },
  { id: 'editor', label: 'Editor', icon: Code2, title: 'Editor', description: "VS Code's editor with autosave and quick-open, right next to the agents changing the same files.", Visual: EditorVisual },
  { id: 'notes', label: 'Notes', icon: NotebookPen, title: 'Notes', description: 'Keep plans and scratch notes in the workspace, and hand them to an agent when they are ready.', Visual: NotesVisual },
  { id: 'ship', label: 'Ship with AI', icon: Rocket, title: 'Ship with AI', description: 'Inspect CI, resolve conflicts, and open PRs without leaving the app.', Visual: ShipVisual }
]

export function DevLoopSection() {
  const [activeId, setActiveId] = useState(tabs[0].id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <section className="mx-auto max-w-[1200px] px-6 pt-32 pb-24">
      <h2 className="text-center text-[34px] font-medium leading-none tracking-[-0.025em] text-foreground sm:text-[48px]">
        Your dev loop, agentified.
      </h2>
      <div className="mx-auto mt-10 flex max-w-full flex-wrap justify-center gap-1" role="tablist" aria-label="Dev loop">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            onClick={() => setActiveId(tab.id)}
            className={
              tab.id === activeId
                ? 'flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-[13.5px] font-medium text-background'
                : 'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-foreground'
            }
          >
            <tab.icon className="size-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-14 grid items-center gap-10 md:grid-cols-[1fr_1.15fr]">
        <div className="max-w-md">
          <h3 className="text-[28px] font-medium tracking-[-0.02em] text-foreground">{active.title}</h3>
          <p className="mt-3 text-[15px] leading-6 text-muted">{active.description}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8">
          <active.Visual />
        </div>
      </div>
    </section>
  )
}
