import { translate } from '@/i18n/i18n'
import { canTransitionDesign, type DesignStatus } from '../../../../shared/design-types'

/** Which confirmation a move needs before it reaches the host; null moves directly. */
export type DesignStatusConfirm = 'approve' | 'discard' | 'finish' | null

export type DesignStatusAction = {
  to: DesignStatus
  label: string
  variant: 'default' | 'outline' | 'destructive'
  /** 'overflow' actions live in the "more" menu: fallbacks, not the normal path. */
  placement: 'primary' | 'overflow'
  confirm: DesignStatusConfirm
  /** Why the move cannot be made yet; null when it can. */
  disabledReason: string | null
}

export type DesignStatusActionContext = {
  /** A live agent terminal holds the design, so a move interrupts or redirects it. */
  agentBound: boolean
  hasCanvas: boolean
  /** The agent still holds the user's latest input (see designProcessingBlocksApproval). */
  agentProcessing: boolean
}

type ActionSpec = Omit<DesignStatusAction, 'label' | 'confirm' | 'disabledReason'> & {
  label: () => string
  confirm: (context: DesignStatusActionContext) => DesignStatusConfirm
  disabledReason?: (context: DesignStatusActionContext) => string | null
}

const discard: ActionSpec = {
  to: 'discarded',
  variant: 'outline',
  placement: 'primary',
  label: () => translate('auto.components.design.action.discard', 'Discard'),
  // Why: a bound agent is told to stop; with none, nothing is interrupted.
  confirm: (context) => (context.agentBound ? 'discard' : null)
}

const ACTIONS: Record<DesignStatus, readonly ActionSpec[]> = {
  draft: [
    {
      to: 'in-progress',
      variant: 'default',
      placement: 'primary',
      label: () => translate('auto.components.design.action.approve', 'Approve design'),
      confirm: () => 'approve',
      // Why: approval means "implement this drawing"; with none, or one about to change, there is nothing settled to approve.
      disabledReason: (context) => {
        if (!context.hasCanvas) {
          return translate(
            'auto.components.design.action.approveNeedsCanvas',
            'Wait for the agent to draw the design before approving it.'
          )
        }
        return context.agentProcessing
          ? translate(
              'auto.components.design.action.approveWhileProcessing',
              'Wait for the agent to finish processing before approving.'
            )
          : null
      }
    },
    discard
  ],
  // Why: finishing normally goes through the agent's completion and the user's confirmation.
  'in-progress': [
    discard,
    {
      to: 'done',
      variant: 'outline',
      placement: 'overflow',
      label: () => translate('auto.components.design.action.markDone', 'Mark as done'),
      confirm: () => 'finish'
    },
    {
      to: 'draft',
      variant: 'outline',
      placement: 'overflow',
      label: () => translate('auto.components.design.action.backToPlanning', 'Back to planning'),
      confirm: () => null
    }
  ],
  done: [
    {
      to: 'in-progress',
      variant: 'outline',
      placement: 'primary',
      label: () =>
        translate('auto.components.design.action.reopenDevelopment', 'Reopen development'),
      confirm: () => null
    }
  ],
  discarded: [
    {
      to: 'draft',
      variant: 'outline',
      placement: 'primary',
      label: () => translate('auto.components.design.action.reopen', 'Reopen'),
      confirm: () => null
    }
  ]
}

/** Buttons offered for a status; each is re-checked against the shared transition table. */
export function designStatusActions(
  status: DesignStatus,
  context: DesignStatusActionContext
): DesignStatusAction[] {
  return ACTIONS[status]
    .filter((action) => canTransitionDesign(status, action.to))
    .map((action) => ({
      to: action.to,
      variant: action.variant,
      placement: action.placement,
      label: action.label(),
      confirm: action.confirm(context),
      disabledReason: action.disabledReason?.(context) ?? null
    }))
}
