import type { ComposerModel } from './composer-model'

type FolderSubmitOrchestrationInput = Pick<
  ComposerModel,
  | 'clearNewWorkspaceDraft'
  | 'createFolderWorkspace'
  | 'decisions'
  | 'disabledTuiAgents'
  | 'folderCreateDisabled'
  | 'folderSourceRepos'
  | 'folderTargetConnectionId'
  | 'folderTargetIsRemote'
  | 'folderTargetRuntimeEnvironmentId'
  | 'isSubmissionCancelled'
  | 'lastAutoNameRef'
  | 'linkedWorkItem'
  | 'name'
  | 'note'
  | 'onCreated'
  | 'persistDraft'
  | 'resolvePendingSmartGitHubSubmit'
  | 'selectedProjectGroup'
  | 'setCreateError'
  | 'setCreating'
  | 'settings'
  | 'taskSourceContext'
  | 'telemetrySource'
>

import { useCallback } from 'react'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { settleComposerSubmit } from '@/lib/composer-submit-cancellation'
import { isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import {
  resolveFolderWorkspaceLaunchDraft,
  submitFolderWorkspaceCreate
} from '@/components/sidebar/folder-workspace-composer-submit'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../../shared/tui-agent-launch-defaults'
import { resolveInitialNativeChatSessionOptions } from '@/components/native-chat/native-chat-launch-session-options'
import { isNativeChatTranscriptLocalReadable } from '@/lib/native-chat-transcript-readability'
import { translate } from '@/i18n/i18n'
import {
  formatWorkspaceCreateError,
  getWorkspaceCreateErrorToastMessage
} from '@/lib/workspace-create-error-format'
import { toast } from 'sonner'
import { ensureWorktreeHasInitialTerminal } from '@/lib/worktree-initial-terminal-seeding'
import { useAppStore } from '@/store'
import type { MultiProjectWorkspaceCreateResult } from '../../../../shared/multi-project-workspace-types'

type FolderWorkspaceCreateRequest = Parameters<
  Parameters<typeof submitFolderWorkspaceCreate>[0]['createFolderWorkspace']
>[0]

type FolderSubmitRun = {
  /** Null for a multi-project workspace, which belongs to no group and runs locally. */
  projectGroup: ProjectGroup | null
  requestedAgent: TuiAgent | null
  /** Overrides the typed name, e.g. with the seed a multi-project create needs for its branch. */
  name?: string
  canResolveSmartGitHub: boolean
  create: (request: FolderWorkspaceCreateRequest) => Promise<FolderWorkspace | null>
  afterCreate?: () => void
}

export function useFolderSubmitOrchestration(input: FolderSubmitOrchestrationInput) {
  const {
    clearNewWorkspaceDraft,
    createFolderWorkspace,
    decisions,
    disabledTuiAgents,
    folderCreateDisabled,
    folderSourceRepos,
    folderTargetConnectionId,
    folderTargetIsRemote,
    folderTargetRuntimeEnvironmentId,
    isSubmissionCancelled,
    lastAutoNameRef,
    linkedWorkItem,
    name,
    note,
    onCreated,
    persistDraft,
    resolvePendingSmartGitHubSubmit,
    selectedProjectGroup,
    setCreateError,
    setCreating,
    settings,
    taskSourceContext,
    telemetrySource
  } = input
  const { canResolveFolderSmartGitHubSubmit } = decisions

  const runFolderSubmit = useCallback(
    async (run: FolderSubmitRun): Promise<void> => {
      setCreateError(null)
      setCreating(true)
      try {
        const smartGitHubSettlement = await settleComposerSubmit(
          run.canResolveSmartGitHub
            ? resolvePendingSmartGitHubSubmit()
            : Promise.resolve({ kind: 'none' } as const),
          isSubmissionCancelled
        )
        if (smartGitHubSettlement.status === 'cancelled') {
          return
        }
        const smartGitHubResolution = smartGitHubSettlement.value
        const smartGitHubMetadata =
          smartGitHubResolution.kind === 'none' ? null : smartGitHubResolution
        const submitLinkedWorkItem = smartGitHubMetadata?.linkedWorkItem ?? linkedWorkItem
        const agent =
          run.requestedAgent && isTuiAgentEnabled(run.requestedAgent, disabledTuiAgents)
            ? run.requestedAgent
            : null
        if (isSubmissionCancelled()) {
          return
        }
        // Why: a multi-project workspace always runs on this machine, whatever group is selected.
        const connectionId = run.projectGroup ? folderTargetConnectionId : null
        const folderLaunchDraftText =
          agent && submitLinkedWorkItem
            ? resolveFolderWorkspaceLaunchDraft(submitLinkedWorkItem, note)
            : null
        const folderWorkspaceCreated = await submitFolderWorkspaceCreate({
          projectGroup: run.projectGroup,
          name: run.name ?? smartGitHubMetadata?.workspaceName ?? name,
          lastAutoName: lastAutoNameRef.current,
          linkedWorkItem: submitLinkedWorkItem,
          linkedTaskSourceContext: taskSourceContext,
          note,
          quickAgent: agent,
          autoRenameBranchFromWork: settings?.autoRenameBranchFromWork,
          agentCmdOverrides: settings?.agentCmdOverrides,
          agentArgs: agent
            ? resolveTuiAgentLaunchArgs(agent, settings?.agentDefaultArgs)
            : undefined,
          agentEnv: agent ? resolveTuiAgentLaunchEnv(agent, settings?.agentDefaultEnv) : undefined,
          sessionOptions: agent
            ? resolveInitialNativeChatSessionOptions(
                {
                  experimentalNativeChat: settings?.experimentalNativeChat,
                  openAgentTabsInChatByDefault: settings?.openAgentTabsInChatByDefault,
                  nativeChatSessionOptions: settings?.nativeChatSessionOptions
                },
                {
                  agent,
                  ...(folderLaunchDraftText
                    ? { promptDelivery: 'draft' as const, launchDraftText: folderLaunchDraftText }
                    : {}),
                  nativeChatTranscriptIsLocalReadable:
                    isNativeChatTranscriptLocalReadable(connectionId)
                }
              )
            : undefined,
          terminalWindowsShell: settings?.terminalWindowsShell,
          isRemote: run.projectGroup ? folderTargetIsRemote : false,
          launchSource: telemetrySource === 'onboarding' ? 'onboarding' : 'new_workspace_composer',
          runtimeEnvironmentId: run.projectGroup ? folderTargetRuntimeEnvironmentId : null,
          createFolderWorkspace: run.create,
          onOpenChange: (open) => {
            if (!open) {
              if (persistDraft) {
                clearNewWorkspaceDraft()
              }
              onCreated?.()
            }
          }
        })
        if (folderWorkspaceCreated) {
          run.afterCreate?.()
        } else {
          setCreateError({
            title: translate(
              'auto.hooks.useComposerState.folderWorkspaceCreateFailedTitle',
              'Folder workspace creation failed'
            ),
            message: translate(
              'auto.hooks.useComposerState.folderWorkspaceCreateFailedMessage',
              'The folder workspace could not be created. Check the error details above, then try again.'
            )
          })
        }
      } catch (error) {
        if (isSubmissionCancelled()) {
          return
        }
        const formattedError = formatWorkspaceCreateError(error)
        setCreateError(formattedError)
        toast.error(getWorkspaceCreateErrorToastMessage(formattedError))
      } finally {
        setCreating(false)
      }
    },
    [
      clearNewWorkspaceDraft,
      disabledTuiAgents,
      folderTargetConnectionId,
      folderTargetIsRemote,
      folderTargetRuntimeEnvironmentId,
      isSubmissionCancelled,
      linkedWorkItem,
      name,
      note,
      onCreated,
      persistDraft,
      resolvePendingSmartGitHubSubmit,
      settings,
      taskSourceContext,
      telemetrySource,
      lastAutoNameRef,
      setCreateError,
      setCreating
    ]
  )

  const submitFolderTarget = useCallback(
    async (requestedAgent: TuiAgent | null): Promise<void> => {
      if (!selectedProjectGroup?.parentPath || folderCreateDisabled) {
        return
      }
      const projectGroupId = selectedProjectGroup.id
      await runFolderSubmit({
        projectGroup: selectedProjectGroup,
        requestedAgent,
        canResolveSmartGitHub: canResolveFolderSmartGitHubSubmit({
          hasFolderSourceRepos: folderSourceRepos.length > 0
        }),
        create: (request) =>
          createFolderWorkspace(
            { ...request, projectGroupId },
            { runtimeEnvironmentId: folderTargetRuntimeEnvironmentId }
          )
      })
    },
    [
      canResolveFolderSmartGitHubSubmit,
      createFolderWorkspace,
      folderCreateDisabled,
      folderSourceRepos.length,
      folderTargetRuntimeEnvironmentId,
      runFolderSubmit,
      selectedProjectGroup
    ]
  )

  /** Creates one workspace holding a worktree per project, all on the branch named after it. */
  const submitMultiProjectTarget = useCallback(
    async (
      requestedAgent: TuiAgent | null,
      repoIds: readonly string[],
      workspaceName: string
    ): Promise<void> => {
      let result: MultiProjectWorkspaceCreateResult | null = null
      await runFolderSubmit({
        projectGroup: null,
        requestedAgent,
        name: workspaceName,
        // Why: the linked item is resolved against the primary project, like a single create.
        canResolveSmartGitHub: true,
        create: async (request) => {
          result = await useAppStore.getState().createMultiProjectWorkspace({
            name: request.name,
            repoIds: [...repoIds],
            linkedTask: request.linkedTask,
            ...(request.linkedTaskSourceContext
              ? { linkedTaskSourceContext: request.linkedTaskSourceContext }
              : {}),
            ...(request.createdWithAgent ? { createdWithAgent: request.createdWithAgent } : {}),
            ...(request.pendingFirstAgentMessageRename
              ? { pendingFirstAgentMessageRename: true }
              : {})
          })
          return result.folderWorkspace
        },
        afterCreate: () => {
          if (result) {
            seedMultiProjectMemberSetup(result)
          }
        }
      })
    },
    [runFolderSubmit]
  )

  return {
    submitFolderTarget,
    submitMultiProjectTarget
  }
}

/** Members aren't activated on create, so queue their setup/default tabs for when they open. */
function seedMultiProjectMemberSetup(result: MultiProjectWorkspaceCreateResult): void {
  for (const member of result.members) {
    if (!member.setup && !member.defaultTabs) {
      continue
    }
    ensureWorktreeHasInitialTerminal(
      useAppStore.getState(),
      member.worktree.id,
      undefined,
      member.setup,
      undefined,
      member.defaultTabs
    )
  }
}
