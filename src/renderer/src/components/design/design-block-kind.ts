import {
  Database,
  GitBranch,
  Monitor,
  MousePointerClick,
  Plug,
  StickyNote,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { DesignBlockKind } from '../../../../shared/design-types'

export const DESIGN_BLOCK_ICON: Record<DesignBlockKind, LucideIcon> = {
  trigger: Zap,
  screen: Monitor,
  action: MousePointerClick,
  decision: GitBranch,
  data: Database,
  integration: Plug,
  note: StickyNote
}

// Why: literal class strings so Tailwind generates them; tones reuse status/primary tokens only.
export const DESIGN_BLOCK_ICON_TONE: Record<DesignBlockKind, string> = {
  trigger: 'text-status-warning',
  screen: 'text-primary',
  action: 'text-foreground',
  decision: 'text-status-warning',
  data: 'text-status-success',
  integration: 'text-primary',
  note: 'text-muted-foreground'
}

export function designBlockKindLabel(kind: DesignBlockKind): string {
  switch (kind) {
    case 'trigger':
      return translate('auto.components.design.block.trigger', 'Trigger')
    case 'screen':
      return translate('auto.components.design.block.screen', 'Screen')
    case 'action':
      return translate('auto.components.design.block.action', 'Action')
    case 'decision':
      return translate('auto.components.design.block.decision', 'Decision')
    case 'data':
      return translate('auto.components.design.block.data', 'Data')
    case 'integration':
      return translate('auto.components.design.block.integration', 'Integration')
    case 'note':
      return translate('auto.components.design.block.note', 'Note')
  }
}
