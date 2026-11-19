import { DESIGN_STATUSES, type DesignListEntry } from '../../../../shared/design-types'
import { filterDesignList, type DesignListFilter } from './design-list-view'

/** Hidden designs that wait on the user, counted per reason; one design can count in several. */
export type DesignListAttention = {
  completion: number
  decisions: number
  blocked: number
  /** The designs to reveal, so "Show" can widen the filter to exactly them. */
  hidden: readonly DesignListEntry[]
}

function needsUser(design: DesignListEntry): boolean {
  return design.completionPending || design.openDecisionCount > 0 || design.deliveryBlocked
}

/**
 * Designs the active filter hides that need the user: a completion to confirm, open decisions, or an
 * agent that stopped reading. Only Draft and In progress count; a closed design waits on no one.
 */
export function designListAttention(
  designs: readonly DesignListEntry[],
  filter: DesignListFilter,
  now: number
): DesignListAttention | null {
  const shown = new Set(filterDesignList(designs, filter, now).map((design) => design.id))
  const hidden = designs.filter(
    (design) =>
      !shown.has(design.id) &&
      (design.status === 'draft' || design.status === 'in-progress') &&
      needsUser(design)
  )
  if (hidden.length === 0) {
    return null
  }
  return {
    completion: hidden.filter((design) => design.completionPending).length,
    decisions: hidden.filter((design) => design.openDecisionCount > 0).length,
    blocked: hidden.filter((design) => design.deliveryBlocked).length,
    hidden
  }
}

/** The filter widened so every hidden design shows: their statuses added, and the dates opened if they excluded one. */
export function revealDesignsInFilter(
  filter: DesignListFilter,
  hidden: readonly DesignListEntry[],
  now: number
): DesignListFilter {
  const wanted = new Set([...filter.statuses, ...hidden.map((design) => design.status)])
  const withStatuses: DesignListFilter = {
    ...filter,
    statuses: DESIGN_STATUSES.filter((status) => wanted.has(status))
  }
  const shown = new Set(filterDesignList(hidden, withStatuses, now).map((design) => design.id))
  return hidden.every((design) => shown.has(design.id))
    ? withStatuses
    : { ...withStatuses, period: 'all', from: null, to: null }
}
