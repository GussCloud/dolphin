import { translate } from '@/i18n/i18n'
import type { DesignStatus } from '../../../../shared/design-types'
import type { DesignPeriodPreset } from './design-list-view'

// Why: literal class strings so Tailwind can generate them and the design-system gate can read them.
export const DESIGN_STATUS_BADGE: Record<DesignStatus, string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  'in-progress': 'border-primary/30 bg-primary/10 text-primary',
  done: 'border-status-success-border bg-status-success-background text-status-success',
  discarded: 'border-destructive/30 bg-destructive/10 text-destructive'
}

export function designStatusLabel(status: DesignStatus): string {
  switch (status) {
    case 'draft':
      return translate('auto.components.design.status.draft', 'Draft')
    case 'in-progress':
      return translate('auto.components.design.status.inProgress', 'In progress')
    case 'done':
      return translate('auto.components.design.status.done', 'Done')
    case 'discarded':
      return translate('auto.components.design.status.discarded', 'Discarded')
  }
}

export function designPeriodLabel(period: DesignPeriodPreset): string {
  switch (period) {
    case '7d':
      return translate('auto.components.design.period.7d', 'Last 7 days')
    case '30d':
      return translate('auto.components.design.period.30d', 'Last 30 days')
    case '90d':
      return translate('auto.components.design.period.90d', 'Last 90 days')
    case 'all':
      return translate('auto.components.design.period.all', 'Any time')
  }
}
