import { translate } from '@/i18n/i18n'
import { canTransitionDesign, type DesignStatus } from '../../../../shared/design-types'

export type DesignStatusAction = {
  to: DesignStatus
  label: string
  variant: 'default' | 'outline' | 'destructive'
}

type ActionSpec = { to: DesignStatus; variant: DesignStatusAction['variant']; label: () => string }

const ACTIONS: Record<DesignStatus, readonly ActionSpec[]> = {
  draft: [
    {
      to: 'in-progress',
      variant: 'default',
      label: () => translate('auto.components.design.action.approve', 'Approve design')
    },
    {
      to: 'discarded',
      variant: 'outline',
      label: () => translate('auto.components.design.action.discard', 'Discard')
    }
  ],
  'in-progress': [
    {
      to: 'done',
      variant: 'default',
      label: () => translate('auto.components.design.action.finish', 'Finish')
    },
    {
      to: 'discarded',
      variant: 'outline',
      label: () => translate('auto.components.design.action.discard', 'Discard')
    }
  ],
  done: [
    {
      to: 'in-progress',
      variant: 'outline',
      label: () =>
        translate('auto.components.design.action.reopenDevelopment', 'Reopen development')
    }
  ],
  discarded: [
    {
      to: 'draft',
      variant: 'outline',
      label: () => translate('auto.components.design.action.reopen', 'Reopen')
    }
  ]
}

/** Buttons offered for a status; each is re-checked against the shared transition table. */
export function designStatusActions(status: DesignStatus): DesignStatusAction[] {
  return ACTIONS[status]
    .filter((action) => canTransitionDesign(status, action.to))
    .map((action) => ({ to: action.to, variant: action.variant, label: action.label() }))
}
