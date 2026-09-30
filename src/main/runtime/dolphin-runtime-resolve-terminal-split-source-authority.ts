// @ts-nocheck -- mechanically split from DolphinRuntimeService; behavior is covered by AST equivalence and characterization tests.
import { DolphinRuntimeWithSplitPtyBackedTerminal } from './dolphin-runtime-split-pty-backed-terminal'
import {
  resolveTerminalSessionWorktreeId,
  runtimeWorktreeIdsEqual
} from './runtime-worktree-path-identity'
import { makePaneKey } from '../../shared/stable-pane-id'
import { terminalLayoutContainsLeaf } from './headless-terminal-split-layout'
import type {
  AgentTeamsTmuxCompatRequest,
  AgentTeamsTmuxCompatResponse
} from './claude-agent-teams-service'
import {
  ensureClaudeAgentTeamsShimDir,
  resolveClaudeAgentTeamsShimBin,
  resolveClaudeAgentTeamsShimPathDirs
} from './claude-agent-teams-shim-env'
import { applyClaudeEnvPatch } from '../claude-accounts/environment'
import {
  canLaunchAgentTeamPanes,
  isWslAgentTeamLeader,
  IN_PROCESS_AGENT_TEAMS_ENV,
  IN_PROCESS_AGENT_TEAMS_ENV_TO_DELETE,
  resolveAgentTeamHostShell,
  type AgentTeamHostShell
} from './claude-agent-teams-host-shell'
import { resolveGitBashPath } from '../git-bash'
import { overlayPlatformEnv } from '../../shared/platform-env-overlay'

export class DolphinRuntimeWithResolveTerminalSplitSourceAuthority extends DolphinRuntimeWithSplitPtyBackedTerminal {
  protected resolveTerminalSplitSourceAuthority(
    worktreeId: string,
    tabId: string,
    leafId: string,
    ptyId: string
  ): {
    persisted: boolean
    rendererMounted: boolean
    persistedWorktreeId: string | null
    persistedIncarnationId: string | null
    liveIncarnationId: string | null
  } | null {
    const session = this.getWorkspaceSessionForWorktree(worktreeId)
    const sessionWorktreeId = session ? resolveTerminalSessionWorktreeId(session, worktreeId) : null
    const persistedTab = sessionWorktreeId
      ? session?.tabsByWorktree[sessionWorktreeId]?.find(
          (tab) => tab.id === tabId && runtimeWorktreeIdsEqual(tab.worktreeId, worktreeId)
        )
      : undefined
    const persistedLayout = session?.terminalLayoutsByTabId?.[tabId]
    const persistedIncarnationId =
      session?.terminalPtyIncarnationsByPaneKey?.[makePaneKey(tabId, leafId)] ?? null
    const liveIncarnationId = this.ptysById.get(ptyId)?.incarnationId ?? null
    if (
      persistedIncarnationId &&
      liveIncarnationId &&
      persistedIncarnationId !== liveIncarnationId
    ) {
      return null
    }
    const persisted = Boolean(
      persistedTab &&
      persistedLayout?.ptyIdsByLeafId?.[leafId] === ptyId &&
      terminalLayoutContainsLeaf(persistedLayout.root, leafId)
    )
    const rendererTab = this.tabs.get(tabId)
    const rendererLeaf = this.leaves.get(this.getLeafKey(tabId, leafId))
    const rendererMounted = Boolean(
      rendererTab &&
      rendererLeaf &&
      runtimeWorktreeIdsEqual(rendererTab.worktreeId, worktreeId) &&
      runtimeWorktreeIdsEqual(rendererLeaf.worktreeId, worktreeId) &&
      rendererLeaf.ptyId === ptyId
    )
    if (persisted && persistedLayout) {
      return {
        persisted: true,
        rendererMounted,
        persistedWorktreeId: sessionWorktreeId,
        persistedIncarnationId,
        liveIncarnationId
      }
    }
    // Why: renderer adoption can precede graph sync; this path still requires reveal success before commit.
    const projected = [...this.mobileSessionTabsByWorktree.entries()].some(
      ([candidateWorktreeId, snapshot]) =>
        runtimeWorktreeIdsEqual(candidateWorktreeId, worktreeId) &&
        snapshot.tabs.some(
          (tab) =>
            tab.type === 'terminal' &&
            tab.parentTabId === tabId &&
            tab.leafId === leafId &&
            (tab.ptyId === ptyId || tab.parentLayout?.ptyIdsByLeafId?.[leafId] === ptyId)
        )
    )
    if (!rendererMounted && !projected) {
      return null
    }
    return {
      persisted: false,
      rendererMounted,
      persistedWorktreeId: null,
      persistedIncarnationId: null,
      liveIncarnationId
    }
  }

  async handleAgentTeamsTmuxCompat(
    request: AgentTeamsTmuxCompatRequest
  ): Promise<AgentTeamsTmuxCompatResponse> {
    return await this.claudeAgentTeams.handleTmuxCompat(request, {
      splitTerminal: (handle, opts) => this.splitTerminal(handle, opts),
      readTerminal: (handle, opts) => this.readTerminal(handle, opts),
      sendTerminal: (handle, action) => this.sendTerminal(handle, action),
      focusTerminal: (handle) => this.focusTerminal(handle),
      closeTerminal: (handle) => this.closeTerminal(handle),
      showTerminal: (handle) => this.showTerminal(handle),
      resolveHostShell: (leaderHandle) => this.resolveClaudeAgentTeamsHostShell(leaderHandle)
    })
  }

  protected resolveClaudeAgentTeamsGitBash(): string | null {
    return resolveGitBashPath()
  }

  private resolveClaudeAgentTeamsHostShell(leaderHandle: string): AgentTeamHostShell | null {
    return resolveAgentTeamHostShell(this.getTerminalPtyRecordForHandle(leaderHandle))
  }

  private isClaudeAgentTeamsWslLeader(leaderHandle: string): boolean {
    return isWslAgentTeamLeader(this.getTerminalPtyRecordForHandle(leaderHandle))
  }

  async prepareClaudeAgentTeamsLeader(args: {
    paneKey: string
    baseEnv?: Record<string, string>
    prepareAuth?: boolean
  }): Promise<{ env: Record<string, string> }> {
    const handle = this.getTerminalHandleForPaneKey(args.paneKey)
    if (!handle) {
      throw new Error('claude_agent_teams_requires_dolphin_terminal')
    }
    return await this.prepareClaudeAgentTeamsLeaderForHandle({
      handle,
      baseEnv: args.baseEnv,
      prepareAuth: args.prepareAuth
    })
  }

  async prepareClaudeAgentTeamsLeaderForHandle(args: {
    handle: string
    baseEnv?: Record<string, string>
    prepareAuth?: boolean
  }): Promise<{ env: Record<string, string>; envToDelete?: string[] }> {
    // Why overlay: the pane's `PATH` must replace main's `Path`, or the launch PATH is built from Electron's.
    const baseEnv = overlayPlatformEnv<string | undefined>(process.env, args.baseEnv ?? {})
    const inheritedEnvKeys = new Set(Object.keys(baseEnv))
    const auth = args.prepareAuth && this.prepareClaudeAuth ? await this.prepareClaudeAuth() : null
    if (auth) {
      applyClaudeEnvPatch(baseEnv, auth.envPatch, { stripAuthEnv: auth.stripAuthEnv })
    }
    const envToDelete = auth?.stripAuthEnv
      ? [...inheritedEnvKeys].filter((key) => !(key in baseEnv))
      : undefined
    const shimBin = resolveClaudeAgentTeamsShimBin(baseEnv)
    const hostShell = this.resolveClaudeAgentTeamsHostShell(args.handle)
    if (
      !canLaunchAgentTeamPanes({
        hostShell,
        leaderIsWsl: this.isClaudeAgentTeamsWslLeader(args.handle),
        shimBin,
        resolveGitBash: () => this.resolveClaudeAgentTeamsGitBash()
      })
    ) {
      // Why: agreed degrade — no team is registered, so Claude keeps teammates in-process.
      return {
        env: { ...auth?.envPatch, ...IN_PROCESS_AGENT_TEAMS_ENV },
        envToDelete: [...(envToDelete ?? []), ...IN_PROCESS_AGENT_TEAMS_ENV_TO_DELETE]
      }
    }
    const shimDir = await ensureClaudeAgentTeamsShimDir()
    const launch = this.claudeAgentTeams.createLaunchEnv({
      leaderHandle: args.handle,
      baseEnv,
      shimDir,
      shimBin,
      shimPathDirs: resolveClaudeAgentTeamsShimPathDirs(shimDir),
      hostShell: hostShell ?? undefined
    })
    const env = auth ? { ...auth.envPatch, ...launch.env } : launch.env
    return envToDelete ? { env, envToDelete } : { env }
  }

  // Why: a leader handle that never binds to a PTY (lost pane race) has no exit
  // or close path to evict its team, so the abandoning caller must release it.
  releaseClaudeAgentTeamsLeaderForHandle(handle: string): void {
    this.claudeAgentTeams.removeTeamForLeaderHandle(handle)
  }

  protected waitForLeafInTab(tabId: string, leafId: string, timeoutMs = 10_000): Promise<string> {
    const tryResolve = (): string | null => {
      const leaf = this.leaves.get(this.getLeafKey(tabId, leafId))
      return leaf?.ptyId !== null && leaf?.ptyId !== undefined ? this.issueHandle(leaf) : null
    }

    const existing = tryResolve()
    if (existing) {
      return Promise.resolve(existing)
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.graphSyncCallbacks.indexOf(check)
        if (idx !== -1) {
          this.graphSyncCallbacks.splice(idx, 1)
        }
        reject(new Error('Timed out waiting for split pane handle'))
      }, timeoutMs)

      const check = (): void => {
        const handle = tryResolve()
        if (handle) {
          clearTimeout(timer)
          const idx = this.graphSyncCallbacks.indexOf(check)
          if (idx !== -1) {
            this.graphSyncCallbacks.splice(idx, 1)
          }
          resolve(handle)
        }
      }
      this.graphSyncCallbacks.push(check)
      check()
    })
  }
}
