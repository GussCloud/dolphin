import { cn } from '@/lib/utils'
import type { DesignStatus } from '../../../../shared/design-types'
import { DESIGN_STATUS_BADGE, designStatusLabel } from './design-status-labels'

// Why: the Badge primitive owns its color, and status chips need a tone per status.
export function DesignStatusBadge({ status }: { status: DesignStatus }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        DESIGN_STATUS_BADGE[status]
      )}
    >
      {designStatusLabel(status)}
    </span>
  )
}
