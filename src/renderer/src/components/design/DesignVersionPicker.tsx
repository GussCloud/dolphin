import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { DesignCanvasVersion } from '../../../../shared/design-types'
import { designVersionLabel } from './design-canvas-history'
import { formatDesignTimestamp } from './design-format'

export function DesignApprovedBadge(): React.JSX.Element {
  return (
    <span
      data-design-approved=""
      className="inline-flex w-fit shrink-0 items-center rounded-full border border-status-success-border bg-status-success-background px-1.5 text-[10px] font-medium leading-4 whitespace-nowrap text-status-success"
    >
      {translate('auto.components.design.version.approved', 'Approved')}
    </span>
  )
}

/** Picks which kept canvas version to draw; the newest is the live one. */
export function DesignVersionPicker({
  versions,
  shownVersion,
  currentVersion,
  approvedVersion,
  onSelect
}: {
  versions: readonly DesignCanvasVersion[]
  shownVersion: number
  currentVersion: number
  approvedVersion: number | null
  /** null returns to the current version. */
  onSelect: (version: number | null) => void
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        value={String(shownVersion)}
        onValueChange={(value) => {
          const version = Number(value)
          onSelect(version === currentVersion ? null : version)
        }}
      >
        <SelectTrigger
          size="sm"
          data-design-version-picker=""
          aria-label={translate('auto.components.design.version.pick', 'Canvas version')}
        >
          <SelectValue>{designVersionLabel(shownVersion)}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {versions.toReversed().map((entry) => (
            <SelectItem
              key={entry.version}
              value={String(entry.version)}
              data-design-version={entry.version}
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5">
                  {designVersionLabel(entry.version)}
                  {entry.version === currentVersion ? (
                    <span className="text-xs text-muted-foreground">
                      {translate('auto.components.design.version.current', '(current)')}
                    </span>
                  ) : null}
                  {entry.version === approvedVersion ? <DesignApprovedBadge /> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDesignTimestamp(entry.at)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {shownVersion === approvedVersion ? <DesignApprovedBadge /> : null}
    </span>
  )
}
