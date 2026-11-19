import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { DESIGN_STATUSES } from '../../../../shared/design-types'
import {
  countDesignListFilters,
  DEFAULT_DESIGN_LIST_FILTER,
  DESIGN_PERIOD_PRESETS,
  toggleDesignStatusFilter,
  type DesignListFilter
} from './design-list-view'
import { designPeriodLabel, designStatusLabel } from './design-status-labels'

function isPeriodPreset(value: string): value is DesignListFilter['period'] {
  return DESIGN_PERIOD_PRESETS.some((preset) => preset === value)
}

export function DesignListFilterMenu({
  filter,
  onChange
}: {
  filter: DesignListFilter
  onChange: (next: DesignListFilter) => void
}): React.JSX.Element {
  const activeCount = countDesignListFilters(filter)
  const fromLabel = translate('auto.components.design.filter.from', 'From')
  const toLabel = translate('auto.components.design.filter.to', 'To')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ListFilter className="size-3.5" />
          {translate('auto.components.design.filter.trigger', 'Filters')}
          {activeCount > 0 ? (
            <span className="rounded-full bg-foreground px-1.5 text-[10px] font-semibold leading-4 text-background">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          {translate('auto.components.design.filter.status', 'Status')}
        </DropdownMenuLabel>
        {DESIGN_STATUSES.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={filter.statuses.includes(status)}
            onCheckedChange={() => onChange(toggleDesignStatusFilter(filter, status))}
            onSelect={(event) => event.preventDefault()}
          >
            {designStatusLabel(status)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {translate('auto.components.design.filter.updated', 'Updated')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filter.period}
          onValueChange={(value) => {
            if (isPeriodPreset(value)) {
              // Why: a preset replaces a custom range; keeping both would hide rows the user can't see why.
              onChange({ ...filter, period: value, from: null, to: null })
            }
          }}
        >
          {DESIGN_PERIOD_PRESETS.map((period) => (
            <DropdownMenuRadioItem
              key={period}
              value={period}
              onSelect={(event) => event.preventDefault()}
            >
              {designPeriodLabel(period)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <div className="grid grid-cols-2 gap-2 px-2 py-1.5">
          <label className="space-y-1 text-[11px] text-muted-foreground">
            <span>{fromLabel}</span>
            <Input
              type="date"
              aria-label={fromLabel}
              value={filter.from ?? ''}
              max={filter.to ?? undefined}
              onChange={(event) =>
                onChange({ ...filter, period: 'all', from: event.target.value || null })
              }
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            <span>{toLabel}</span>
            <Input
              type="date"
              aria-label={toLabel}
              value={filter.to ?? ''}
              min={filter.from ?? undefined}
              onChange={(event) =>
                onChange({ ...filter, period: 'all', to: event.target.value || null })
              }
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
        </div>
        {activeCount > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(DEFAULT_DESIGN_LIST_FILTER)}>
              {translate('auto.components.design.filter.reset', 'Reset filters')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
