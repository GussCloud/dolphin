import {
  buildCommitMessagePrompt,
  splitGeneratedCommitMessage,
  type CommitMessageDraftContext
} from '../../shared/commit-message-generation'
import {
  buildPullRequestFieldsPrompt,
  parseGeneratedPullRequestFields,
  type GeneratedPullRequestFields,
  type PullRequestDraftContext
} from '../../shared/pull-request-generation'
import {
  buildBranchNamePrompt,
  sanitizeBranchSlug,
  type BranchNameWorkContext
} from '../../shared/branch-name-from-work'
import type { CommandTemplateBackslash } from '../../shared/commit-message-prompt'
import {
  planCommitMessageGeneration,
  type CommitMessagePlan
} from '../../shared/commit-message-plan'
import type { ResolvedSourceControlAiGenerationParams } from '../../shared/source-control-ai'
import { isDeepSeekProviderEnv, isDeepSeekTuiAgent } from '../../shared/deepseek-claude-provider'
import { isClaudeApiProviderEnv, isClaudeApiTuiAgent } from '../../shared/claude-api-provider'
import { formatLinkedIssueTemplateValue } from '../../shared/source-control-ai-action-variables'
import { renderSourceControlActionCommandTemplate } from '../../shared/source-control-ai-actions'
import { captureAgentGenerationFailureOutput } from './agent-failure-output'
import { runLocalPlanForAgent } from './source-control-local-generation'
import { runRemoteSourceControlPlan } from './source-control-remote-generation'
import type {
  CommitMessageGenerationTarget,
  GenerateBranchNameResult,
  GenerateCommitMessageResult,
  GeneratePullRequestFieldsResult,
  InternalTextGenerationResult,
  SpawnSourceControlAgent,
  TextGenerationOperation
} from './source-control-text-generation-types'

type GenerateParams = ResolvedSourceControlAiGenerationParams

export function trimGeneratedCommitMessage(message: string): string {
  return message.replace(/\s+$/, '')
}

export function commandBackslashMode(
  target: CommitMessageGenerationTarget,
  platform: NodeJS.Platform = process.platform
): CommandTemplateBackslash {
  return platform === 'win32' && target.kind === 'local' && !target.wslDistro ? 'literal' : 'escape'
}

/**
 * DeepSeek and the API-key agent run the claude binary; without their env it would answer on the
 * Anthropic login, so they run only locally, never in WSL, and only with their provider marker.
 */
function refuseOwnCredentialsGeneration(
  agentId: string,
  target: CommitMessageGenerationTarget
): string | null {
  const provider = isDeepSeekTuiAgent(agentId)
    ? { label: 'DeepSeek', hasEnv: isDeepSeekProviderEnv }
    : isClaudeApiTuiAgent(agentId)
      ? { label: 'Claude API', hasEnv: isClaudeApiProviderEnv }
      : null
  if (!provider) {
    return null
  }
  if (target.kind === 'remote') {
    return `${provider.label} text generation runs only on this computer, not on an SSH host.`
  }
  // Why: wsl.exe forwards only a few launcher keys, so the key would have to ride argv.
  if (target.wslDistro) {
    return `${provider.label} text generation runs only on this computer, not inside WSL.`
  }
  if (!provider.hasEnv(target.env)) {
    return `${provider.label} text generation needs its key and config; nothing was run.`
  }
  return null
}

async function executeGenerationPlan(input: {
  params: GenerateParams
  plan: CommitMessagePlan
  target: CommitMessageGenerationTarget
  emptyResultName: string
  operation: TextGenerationOperation
  spawnAgent: SpawnSourceControlAgent
}): Promise<InternalTextGenerationResult> {
  const ownCredentialsRefusal = refuseOwnCredentialsGeneration(input.params.agentId, input.target)
  if (ownCredentialsRefusal) {
    return { success: false, error: ownCredentialsRefusal }
  }
  return input.target.kind === 'remote'
    ? runRemoteSourceControlPlan({
        plan: input.plan,
        target: input.target,
        emptyResultName: input.emptyResultName,
        operation: input.operation
      })
    : runLocalPlanForAgent({
        agentId: input.params.agentId,
        plan: input.plan,
        target: input.target,
        emptyResultName: input.emptyResultName,
        operation: input.operation,
        spawnAgent: input.spawnAgent
      })
}

export async function generateCommitMessage(input: {
  context: CommitMessageDraftContext
  params: GenerateParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
}): Promise<GenerateCommitMessageResult> {
  const { context, params, target } = input
  const basePrompt = buildCommitMessagePrompt(context, '')
  const prompt =
    params.commandInputTemplate !== undefined
      ? renderSourceControlActionCommandTemplate(params.commandInputTemplate, {
          basePrompt,
          branch: context.branch ?? '(detached)',
          stagedFiles: context.stagedSummary,
          stagedPatch: context.stagedPatch,
          linkedIssue: formatLinkedIssueTemplateValue(context.linkedIssue)
        })
      : buildCommitMessagePrompt(context, params.customPrompt ?? '')
  const planned = planCommitMessageGeneration(
    { ...params, backslash: commandBackslashMode(target) },
    prompt
  )
  if (!planned.ok) {
    return { success: false, error: planned.error }
  }
  const result = await executeGenerationPlan({
    ...input,
    plan: planned.plan,
    emptyResultName: 'message',
    operation: 'commit-message'
  })
  if (!result.success) {
    return { success: false, error: result.error, canceled: result.canceled }
  }
  try {
    return {
      success: true,
      message: trimGeneratedCommitMessage(splitGeneratedCommitMessage(result.rawOutput).message),
      agentLabel: result.agentLabel
    }
  } catch {
    return { success: false, error: 'Generated commit message could not be parsed.' }
  }
}

export async function generatePullRequestFields(input: {
  context: PullRequestDraftContext
  params: GenerateParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
}): Promise<GeneratePullRequestFieldsResult<GeneratedPullRequestFields>> {
  const { context, params, target } = input
  const basePrompt = buildPullRequestFieldsPrompt(context, '')
  const prompt =
    params.commandInputTemplate !== undefined
      ? renderSourceControlActionCommandTemplate(params.commandInputTemplate, {
          basePrompt,
          branch: context.branch ?? '(detached)',
          baseBranch: context.base,
          currentTitle: context.currentTitle,
          currentBody: context.currentBody,
          commitSummary: context.commitSummary,
          changedFiles: context.changeSummary,
          patch: context.patch,
          linkedIssue: formatLinkedIssueTemplateValue(context.linkedIssue)
        })
      : buildPullRequestFieldsPrompt(context, params.customPrompt ?? '')
  const planned = planCommitMessageGeneration(
    { ...params, backslash: commandBackslashMode(target) },
    prompt
  )
  if (!planned.ok) {
    return {
      success: false,
      error: planned.error,
      branchChangedByPreparation: context.branchChangedByPreparation
    }
  }
  const result = await executeGenerationPlan({
    ...input,
    plan: planned.plan,
    emptyResultName: 'details',
    operation: 'pull-request-fields'
  })
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      canceled: result.canceled,
      branchChangedByPreparation: context.branchChangedByPreparation
    }
  }
  try {
    return {
      success: true,
      fields: parseGeneratedPullRequestFields(result.rawOutput, context),
      agentLabel: result.agentLabel,
      branchChangedByPreparation: context.branchChangedByPreparation
    }
  } catch {
    return {
      success: false,
      error: 'Generated pull request details could not be parsed.',
      branchChangedByPreparation: context.branchChangedByPreparation
    }
  }
}

export async function generateBranchName(input: {
  context: BranchNameWorkContext
  params: GenerateParams
  target: CommitMessageGenerationTarget
  spawnAgent: SpawnSourceControlAgent
}): Promise<GenerateBranchNameResult> {
  const { context, params, target } = input
  const basePrompt = buildBranchNamePrompt(context)
  const prompt =
    params.commandInputTemplate !== undefined
      ? renderSourceControlActionCommandTemplate(params.commandInputTemplate, {
          basePrompt,
          firstPrompt: context.firstPrompt,
          assistantMessage: context.assistantMessage ?? ''
        })
      : buildBranchNamePrompt(context, params.customPrompt ?? '')
  const planned = planCommitMessageGeneration(
    { ...params, backslash: commandBackslashMode(target) },
    prompt
  )
  if (!planned.ok) {
    return { success: false, error: planned.error }
  }
  const result = await executeGenerationPlan({
    ...input,
    plan: planned.plan,
    emptyResultName: 'branch name',
    operation: 'branch-name'
  })
  if (!result.success) {
    return result
  }
  const slug = sanitizeBranchSlug(result.rawOutput)
  return slug
    ? { success: true, slug, agentLabel: result.agentLabel }
    : {
        success: false,
        error: 'Generated branch name was empty after sanitization.',
        failureOutput:
          captureAgentGenerationFailureOutput(planned.plan.label, 0, result.rawOutput, '') ??
          undefined
      }
}
