import { isOwnCredentialsClaudeTuiAgent } from '../../shared/own-credentials-claude-provider'
import { parseWslUncPath } from '../../shared/wsl-paths'
import type { SshGitProvider } from '../providers/ssh-git-provider'
import type { CommitMessageGenerationTarget } from '../text-generation/commit-message-text-generation'
import {
  prepareLocalCommitMessageAgentEnv,
  type CommitMessageAgentEnvironmentResolvers
} from '../text-generation/commit-message-agent-environment'

/** Resolve where the branch-name generation runs: a remote SSH provider when one
 *  is present, else the local agent env (null when that env can't be prepared). */
export async function resolveGenerationTarget(
  worktreePath: string,
  agentId: string,
  provider: SshGitProvider | null,
  deps: { getAgentEnvResolvers: () => CommitMessageAgentEnvironmentResolvers | undefined }
): Promise<CommitMessageGenerationTarget | null> {
  if (provider) {
    return {
      kind: 'remote',
      cwd: worktreePath,
      execute: (plan, cwd, timeoutMs, operation) =>
        provider.executeCommitMessagePlan(plan, cwd, timeoutMs, operation),
      missingBinaryLocation: 'remote PATH'
    }
  }
  // Why: DeepSeek and API-key generation refuse WSL; a `\\wsl$` cwd sets no WSL target here, so
  // without this it would run the host `claude` with the key on a WSL worktree.
  if (isOwnCredentialsClaudeTuiAgent(agentId) && parseWslUncPath(worktreePath)) {
    return null
  }
  const localEnv = await prepareLocalCommitMessageAgentEnv(
    agentId,
    deps.getAgentEnvResolvers(),
    undefined,
    { workspacePath: worktreePath }
  )
  if (!localEnv.ok) {
    return null
  }
  return { kind: 'local', cwd: worktreePath, ...(localEnv.env ? { env: localEnv.env } : {}) }
}
