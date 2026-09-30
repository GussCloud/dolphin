import { FORK_WEB_URLS } from './fork-identity'
export type FeatureWallTileId =
  | 'tile-01'
  | 'tile-02'
  | 'tile-03'
  | 'tile-04'
  | 'tile-05'
  | 'tile-06'
  | 'tile-07'
  | 'tile-08'
  | 'tile-09'
  | 'tile-10'
  | 'tile-11'
  | 'tile-12'

type FeatureWallTileBase = {
  id: FeatureWallTileId
  title: string
  caption: string
  owner: string
  docsUrl: string
}

export type FeatureWallTile =
  | (FeatureWallTileBase & {
      kind: 'media'
    })
  | (FeatureWallTileBase & {
      kind: 'agent-status-mockup'
    })

export const FEATURE_WALL_MEDIA_TILE_IDS = [
  'tile-01',
  'tile-02',
  'tile-03',
  'tile-04',
  'tile-05',
  'tile-06',
  'tile-07',
  'tile-08',
  'tile-09',
  'tile-10',
  'tile-11',
  'tile-12'
] as const satisfies readonly FeatureWallTileId[]

export type FeatureWallMediaTileId = (typeof FEATURE_WALL_MEDIA_TILE_IDS)[number]

export type FeatureWallMediaTile = Extract<FeatureWallTile, { kind: 'media' }>

export function isFeatureWallMediaTile(tile: FeatureWallTile): tile is FeatureWallMediaTile {
  return tile.kind === 'media'
}

export const FEATURE_WALL_TILES: readonly FeatureWallTile[] = [
  {
    id: 'tile-01',
    kind: 'media',
    title: 'Parallel workspace orchestration',
    caption:
      'Give each task its own workspace - no stashing, no branch juggling. Fan work across agents, compare, and continue with the best result.',
    owner: 'worktree-orchestration',
    docsUrl: `${FORK_WEB_URLS.docs}/model/worktrees`
  },
  {
    id: 'tile-02',
    kind: 'media',
    title: 'Ghostty-class terminal',
    caption:
      'WebGL rendering, infinite splits, scrollback restored on restart, full scrollback search.',
    owner: 'terminal',
    docsUrl: `${FORK_WEB_URLS.docs}/terminal`
  },
  {
    id: 'tile-03',
    kind: 'media',
    title: 'GitHub & Linear, native',
    caption:
      'Find connected GitHub or Linear work in Tasks, open its context, and start workspaces without switching tools.',
    owner: 'task-integrations',
    docsUrl: `${FORK_WEB_URLS.docs}/review/linear`
  },
  {
    id: 'tile-04',
    kind: 'media',
    title: 'Supported CLI agents',
    caption: 'Claude Code, Codex, Cursor CLI, Gemini, Copilot, OpenCode, and Pi are preconfigured.',
    owner: 'agent-integrations',
    docsUrl: `${FORK_WEB_URLS.docs}/agents/supported`
  },
  {
    id: 'tile-05',
    kind: 'media',
    title: 'Embedded browser + Design Mode',
    caption:
      'A real Chromium window per workspace. Click any UI element to send its HTML, CSS, and a cropped screenshot into your agent.',
    owner: 'browser-experience',
    docsUrl: `${FORK_WEB_URLS.docs}/browser/design-mode`
  },
  {
    id: 'tile-06',
    kind: 'media',
    title: 'Remote workspaces',
    caption:
      'Run agents on a remote machine with the same Dolphin editing, git, and terminal workflow.',
    owner: 'ssh-workspaces',
    docsUrl: `${FORK_WEB_URLS.docs}/ssh`
  },
  {
    id: 'tile-07',
    kind: 'media',
    title: 'Monaco editor, drag-to-agent',
    caption:
      "VS Code's editor, autosave everywhere, quick-open with hidden files, drag-drop files or Finder images into an agent prompt.",
    owner: 'editor',
    docsUrl: `${FORK_WEB_URLS.docs}/editing/file-explorer`
  },
  {
    id: 'tile-08',
    kind: 'media',
    title: 'Inline review, back to the agent',
    caption:
      'Drop markdown comments on any diff line, batch them, ship them back to the agent. Inspect CI, resolve conflicts, open PRs - all in-app.',
    owner: 'diff-review',
    docsUrl: `${FORK_WEB_URLS.docs}/review/annotate-ai-diff`
  },
  {
    id: 'tile-09',
    kind: 'media',
    title: 'Dolphin CLI',
    caption: 'Agents can drive Dolphin too: create workspaces, snapshot screens, click, and fill.',
    owner: 'dolphin-cli',
    docsUrl: `${FORK_WEB_URLS.docs}/cli/overview`
  },
  {
    id: 'tile-10',
    kind: 'media',
    title: 'Keyboard-native',
    caption:
      'Jump across workspaces, open files, and remap every shortcut. Move at the speed of your fingers.',
    owner: 'keyboard-ux',
    docsUrl: `${FORK_WEB_URLS.docs}/model/quick-open`
  },
  {
    id: 'tile-11',
    kind: 'media',
    title: 'Usage & rate-limit aware',
    caption:
      'See Claude and Codex usage, rate-limit resets, and hot-swap Codex accounts without re-logging in.',
    owner: 'usage-rate-limits',
    docsUrl: `${FORK_WEB_URLS.docs}/agents/usage-tracking`
  },
  {
    id: 'tile-12',
    kind: 'media',
    title: 'PDFs, images, CSV, Markdown',
    caption:
      'Preview everything your repo carries: PDFs, image diff modes, CSV tables, wiki-linked Markdown with search.',
    owner: 'file-preview',
    docsUrl: `${FORK_WEB_URLS.docs}/editing/viewers`
  }
] as const
