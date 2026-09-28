export type FeatureIllustration =
  | 'workspaces'
  | 'terminal'
  | 'browser'
  | 'tasks'
  | 'agents'
  | 'remote'
  | 'file-drop'
  | 'diff-comment'
  | 'cli'
  | 'search'
  | 'usage'
  | 'notes'
  | 'split'

export type FeatureShowcaseItem = {
  title: string
  description: string
  illustration: FeatureIllustration
  commands?: string[]
}

export const FEATURE_SHOWCASE: FeatureShowcaseItem[] = [
  {
    title: 'Parallel Worktrees',
    description:
      'Every task runs in its own isolated git worktree. No stashing, no branch juggling. Fan one prompt across several agents, compare, merge the winner.',
    illustration: 'workspaces'
  },
  {
    title: 'Terminal Splits',
    description:
      'GPU-rendered terminals, unlimited splits, scrollback restored on restart, full scrollback search.',
    illustration: 'terminal'
  },
  {
    title: 'Design Mode',
    description:
      'A real Chromium window per worktree. Click any UI element to send its HTML, CSS, and a cropped screenshot into your agent.',
    illustration: 'browser'
  },
  {
    title: 'GitHub & Linear, native',
    description:
      'Browse PRs, issues, and project boards in-app. Open a worktree from any task, review PRs, and create Linear issues without a context switch.',
    illustration: 'tasks'
  },
  {
    title: 'Every CLI Agent',
    description:
      'Claude Code, Codex, Cursor CLI, Gemini, Copilot, OpenCode, Pi, all preconfigured. Any other CLI agent drops right in.',
    illustration: 'agents'
  },
  {
    title: 'SSH & WSL Worktrees',
    description:
      'Run agents on a remote machine or inside WSL with full file editing, git, and terminals. Auto-reconnect and port forwarding.',
    illustration: 'remote'
  },
  {
    title: 'Drag Files to Agents',
    description:
      "VS Code's editor, autosave everywhere, quick-open with hidden files, drag-drop files or Explorer images into an agent prompt.",
    illustration: 'file-drop'
  },
  {
    title: 'Annotate AI Diffs',
    description:
      'Drop markdown comments on any diff line, batch them, ship them back to the agent. Inspect CI, resolve conflicts, open PRs, all in-app.',
    illustration: 'diff-comment'
  },
  {
    title: 'Dolphin CLI',
    description: 'Agents drive Dolphin too:',
    commands: ['dolphin worktree create', 'snapshot', 'click', 'fill'],
    illustration: 'cli'
  },
  {
    title: 'Native Search',
    description:
      'Search across worktrees, files, agents, commands, and repo context without leaving your flow.',
    illustration: 'search'
  },
  {
    title: 'Account Switcher & Usage Tracking',
    description:
      'See Claude and Codex usage, rate-limit resets, and hot-swap Codex accounts without re-logging in.',
    illustration: 'usage'
  },
  {
    title: 'Rich Repo Previews',
    description:
      'Preview Markdown, images, PDFs, and repo docs in the workspace without bouncing between apps.',
    illustration: 'notes'
  },
  {
    title: 'Split Anything',
    description:
      'Arrange agents, terminals, browsers, diffs, and files into split panes that match the shape of the task.',
    illustration: 'split'
  }
]
