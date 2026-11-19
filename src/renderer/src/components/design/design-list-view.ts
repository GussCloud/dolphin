import type { DesignListEntry, DesignStatus } from '../../../../shared/design-types'

export const DESIGN_PERIOD_PRESETS = ['7d', '30d', '90d', 'all'] as const
export type DesignPeriodPreset = (typeof DESIGN_PERIOD_PRESETS)[number]

const PERIOD_DAYS: Record<Exclude<DesignPeriodPreset, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
}
const DAY_MS = 24 * 60 * 60 * 1000

export type DesignListFilter = {
  /** Empty means no status is selected, so nothing matches; it is not "every status". */
  statuses: readonly DesignStatus[]
  period: DesignPeriodPreset
  /** Local calendar days (`yyyy-mm-dd` from `<input type="date">`), both inclusive. */
  from: string | null
  to: string | null
}

export const DEFAULT_DESIGN_LIST_FILTER: DesignListFilter = {
  statuses: ['draft'],
  period: 'all',
  from: null,
  to: null
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Start of the given local day in ms, or null when the text is not a real `yyyy-mm-dd` date. */
export function parseLocalDay(day: string | null): number | null {
  const match = day ? DAY_PATTERN.exec(day) : null
  if (!match) {
    return null
  }
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const start = new Date(year, month - 1, date)
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== date) {
    return null
  }
  return start.getTime()
}

/** The updatedAt window the filter allows: [min, max), either bound open when null. */
export function designFilterWindow(
  filter: DesignListFilter,
  now: number
): { min: number | null; max: number | null } {
  const presetMin = filter.period === 'all' ? null : now - PERIOD_DAYS[filter.period] * DAY_MS
  const fromMin = parseLocalDay(filter.from)
  const toStart = parseLocalDay(filter.to)
  const toMax = toStart === null ? null : nextLocalDay(toStart)
  const mins = [presetMin, fromMin].filter((value) => value !== null)
  return {
    min: mins.length > 0 ? Math.max(...mins) : null,
    max: toMax
  }
}

function nextLocalDay(dayStart: number): number {
  const date = new Date(dayStart)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
}

/** Matches the filter, newest update first. */
export function filterDesignList(
  designs: readonly DesignListEntry[],
  filter: DesignListFilter,
  now: number
): DesignListEntry[] {
  const { min, max } = designFilterWindow(filter, now)
  return designs
    .filter(
      (design) =>
        filter.statuses.includes(design.status) &&
        (min === null || design.updatedAt >= min) &&
        (max === null || design.updatedAt < max)
    )
    .toSorted((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
}

/** Filters that differ from the default, for the trigger badge. */
export function countDesignListFilters(filter: DesignListFilter): number {
  const defaultStatuses = DEFAULT_DESIGN_LIST_FILTER.statuses
  const statusesChanged =
    filter.statuses.length !== defaultStatuses.length ||
    filter.statuses.some((status) => !defaultStatuses.includes(status))
  return (
    (statusesChanged ? 1 : 0) +
    (filter.period === 'all' ? 0 : 1) +
    (filter.from ? 1 : 0) +
    (filter.to ? 1 : 0)
  )
}

export function toggleDesignStatusFilter(
  filter: DesignListFilter,
  status: DesignStatus
): DesignListFilter {
  const statuses = filter.statuses.includes(status)
    ? filter.statuses.filter((entry) => entry !== status)
    : [...filter.statuses, status]
  return { ...filter, statuses }
}
