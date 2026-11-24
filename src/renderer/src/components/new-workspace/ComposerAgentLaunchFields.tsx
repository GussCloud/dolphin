import React from 'react'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { ComposerAgentAccountField } from './ComposerAgentAccountField'
import { ComposerAgentPermissionPolicyField } from './ComposerAgentPermissionPolicyField'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'

/** Per-workspace choices about how the created agent launches; each hides when it does not apply. */
export function ComposerAgentLaunchFields({
  quickAgent,
  repoId,
  executionHostId,
  agentAccountId,
  onAgentAccountIdChange,
  agentPermissionPolicy,
  onAgentPermissionPolicyChange
}: Pick<
  NewWorkspaceComposerCardProps,
  | 'agentAccountId'
  | 'onAgentAccountIdChange'
  | 'agentPermissionPolicy'
  | 'onAgentPermissionPolicyChange'
> & {
  quickAgent: TuiAgent | null
  repoId: string
  executionHostId: string | null | undefined
}): React.JSX.Element {
  return (
    <>
      {onAgentAccountIdChange ? (
        <ComposerAgentAccountField
          agent={quickAgent}
          repoId={repoId}
          executionHostId={executionHostId}
          value={agentAccountId ?? null}
          onValueChange={onAgentAccountIdChange}
        />
      ) : null}
      {onAgentPermissionPolicyChange ? (
        <ComposerAgentPermissionPolicyField
          agent={quickAgent}
          executionHostId={executionHostId}
          value={agentPermissionPolicy ?? null}
          onValueChange={onAgentPermissionPolicyChange}
        />
      ) : null}
    </>
  )
}
