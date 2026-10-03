import { translate } from '@/i18n/i18n'
import type { MemoryBudgetWarning } from '../../../../shared/process-stats-types'
import { formatMemory } from './resource-usage-metrics'

function memoryBudgetOwnerLabel(warning: MemoryBudgetWarning): string {
  switch (warning.kind) {
    case 'renderer':
      return translate(
        'auto.components.status.bar.resource.memory.budget.copy.rendererOwner',
        'Dolphin window'
      )
    case 'daemon':
      return translate(
        'auto.components.status.bar.resource.memory.budget.copy.daemonOwner',
        'Terminal daemon'
      )
    case 'session':
      return warning.subject
  }
}

export function formatMemoryBudgetWarning(warning: MemoryBudgetWarning): string {
  return translate(
    'auto.components.status.bar.resource.memory.budget.copy.overBudget',
    '{{owner}} over memory budget: {{used}} (limit {{limit}})',
    {
      owner: memoryBudgetOwnerLabel(warning),
      used: formatMemory(warning.bytes),
      limit: formatMemory(warning.limitBytes)
    }
  )
}

export function memoryOverBudgetLabel(): string {
  return translate(
    'auto.components.status.bar.resource.memory.budget.copy.triggerLabel',
    'Memory over budget'
  )
}
