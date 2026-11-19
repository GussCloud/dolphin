import { translate } from '@/i18n/i18n'
import type { Design, DesignCanvasVersion } from '../../../../shared/design-types'

const INTO_IN_PROGRESS = / -> in-progress$/
const INTO_DRAFT = / -> draft$/

function lastStatusMoveAt(design: Pick<Design, 'events'>, into: RegExp): number {
  return (
    design.events.findLast(
      (event) => event.kind === 'status-changed' && into.test(event.detail ?? '')
    )?.at ?? Number.NEGATIVE_INFINITY
  )
}

/**
 * The canvas version the user approved for implementation, or null when there is no live approval.
 * Read from the newest approval notice the host queued for the agent; when that item is gone or
 * carries no version, from the newest canvas drawn before the newest move into In progress.
 * A move back to Draft voids every earlier approval.
 */
export function designApprovedVersion(
  design: Pick<Design, 'status' | 'inbox' | 'events' | 'canvasVersions'>
): number | null {
  if (design.status === 'draft') {
    return null
  }
  const voidedAt = lastStatusMoveAt(design, INTO_DRAFT)
  const approval = design.inbox.findLast(
    (item) =>
      item.kind === 'status' &&
      item.refId === 'in-progress' &&
      item.canvasVersion !== undefined &&
      item.createdAt > voidedAt
  )
  if (approval?.canvasVersion !== undefined) {
    return approval.canvasVersion
  }
  const approvedAt = lastStatusMoveAt(design, INTO_IN_PROGRESS)
  if (approvedAt <= voidedAt) {
    return null
  }
  return design.canvasVersions.findLast((version) => version.at <= approvedAt)?.version ?? null
}

export type DesignCanvasView = {
  shown: DesignCanvasVersion
  current: DesignCanvasVersion
  /** True when the user picked an older version; the canvas is then read-only history. */
  historical: boolean
}

/** The version to draw: the picked one while it is still kept, else the current one. */
export function designCanvasView(
  versions: readonly DesignCanvasVersion[],
  selectedVersion: number | null
): DesignCanvasView | null {
  const current = versions.at(-1)
  if (!current) {
    return null
  }
  const picked =
    selectedVersion === null
      ? undefined
      : versions.find((version) => version.version === selectedVersion)
  const shown = picked ?? current
  return { shown, current, historical: shown.version !== current.version }
}

export function designVersionLabel(version: number): string {
  return translate('auto.components.design.detail.version', 'Version {{value0}}', {
    value0: version
  })
}
