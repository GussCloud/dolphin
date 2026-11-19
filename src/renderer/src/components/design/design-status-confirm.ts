import { translate } from '@/i18n/i18n'
import type { ConfirmationDialogOptions } from '@/components/confirmation-dialog-context'
import type { DesignStatusConfirm } from './design-status-actions'

export type DesignStatusConfirmContext = {
  /** The canvas version the move applies to; approval needs one, other moves ignore it. */
  canvasVersion: number | null
  openDecisionCount: number
  /** User input the agent has not read; approving sends the approval after it. */
  unreadInputCount: number
}

function approveDescription(context: DesignStatusConfirmContext): string {
  const start = translate(
    'auto.components.design.confirm.approveDescription',
    "The agent will start implementing canvas version {{value0}} in the design's workspace.",
    { value0: context.canvasVersion }
  )
  const warnings = [
    context.openDecisionCount === 0
      ? null
      : translate(
          'auto.components.design.confirm.approveOpenDecisions',
          '{{value0}} open decisions will go unanswered. Answer them first so the agent builds what you chose.',
          { value0: context.openDecisionCount }
        ),
    context.unreadInputCount === 0
      ? null
      : translate(
          'auto.components.design.confirm.approveUnreadInput',
          'The agent has not read {{value0}} of your messages yet; it will receive them before the approval.',
          { value0: context.unreadInputCount }
        )
  ].filter((warning) => warning !== null)
  return [start, ...warnings].join('\n\n')
}

/** Dialog copy for a status move that needs the user's confirmation. */
export function designStatusConfirmOptions(
  kind: Exclude<DesignStatusConfirm, null>,
  context: DesignStatusConfirmContext
): ConfirmationDialogOptions {
  switch (kind) {
    case 'approve':
      return {
        title: translate('auto.components.design.confirm.approveTitle', 'Approve this design?'),
        description: approveDescription(context),
        confirmLabel: translate(
          'auto.components.design.confirm.approveConfirm',
          'Approve and implement'
        )
      }
    case 'discard':
      return {
        title: translate('auto.components.design.confirm.discardTitle', 'Discard this design?'),
        description: translate(
          'auto.components.design.confirm.discardDescription',
          'The agent will be told to stop working on it. You can reopen the design later.'
        ),
        confirmLabel: translate('auto.components.design.action.discard', 'Discard'),
        confirmVariant: 'destructive'
      }
    case 'finish':
      return {
        title: translate('auto.components.design.confirm.finishTitle', 'Mark as done?'),
        description: translate(
          'auto.components.design.confirm.finishDescription',
          'The agent has not reported that it finished. Use this when the agent is gone and you know the implementation is complete.'
        ),
        confirmLabel: translate('auto.components.design.action.markDone', 'Mark as done')
      }
  }
}
