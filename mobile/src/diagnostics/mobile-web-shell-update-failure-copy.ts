import type { MobileWebBundleErrorCode } from '../../../src/shared/mobile-web-bundle/bundle-rpc-contract'
import { BUILD_ID_PREFIX_LENGTH } from '../mobile-web-shell/mobile-web-shell-dev-facts'
import type {
  MobileWebShellUpdateFailure,
  MobileWebShellUpdateFailureOutcome,
  MobileWebShellUpdateFailureReason,
  MobileWebShellUpdateFailureWall
} from '../mobile-web-shell/mobile-web-shell-update-failure'
import { formatTimeAgo } from '../worktree/agent-row-display'
import { diagnosticsCatalog } from '../i18n/catalogs/diagnostics'
import { translate } from '../i18n/mobile-locale-state'

/** Each phrase restates the recorded code and nothing more: this row claims only what was written. */
const REASON_COPY = {
  'no-connection': 'reasonNoConnection',
  'connection-lost': 'reasonConnectionLost',
  'host-refused': 'reasonHostRefused',
  'reply-unreadable': 'reasonReplyUnreadable',
  'chunk-oversize': 'reasonChunkOversize',
  'asset-overlong': 'reasonAssetOverlong',
  'asset-no-progress': 'reasonAssetNoProgress',
  'asset-short': 'reasonAssetShort',
  'asset-checksum-mismatch': 'reasonAssetChecksumMismatch',
  'build-changed-mid-fetch': 'reasonBuildChangedMidFetch',
  'chunk-misrouted': 'reasonChunkMisrouted',
  'asset-entry-changed': 'reasonAssetEntryChanged',
  'range-undecodable': 'reasonRangeUndecodable',
  'fetch-stopped': 'reasonFetchStopped',
  'cache-write-failed': 'reasonCacheWriteFailed',
  'unrecognised-error': 'reasonUnrecognisedError'
} as const satisfies Record<MobileWebShellUpdateFailureReason, string>

const HOST_CODE_COPY = {
  mobile_web_bundle_unavailable: 'hostCodeUnavailable',
  mobile_web_bundle_build_changed: 'hostCodeBuildChanged',
  mobile_web_bundle_asset_unknown: 'hostCodeAssetUnknown',
  mobile_web_bundle_asset_changed: 'hostCodeAssetChanged',
  mobile_web_bundle_offset_invalid: 'hostCodeOffsetInvalid',
  mobile_web_bundle_read_limited: 'hostCodeReadLimited'
} as const satisfies Record<MobileWebBundleErrorCode, string>

const WALL_COPY = {
  'bundle-unavailable': 'wallBundleUnavailable',
  'bundle-shell-too-old': 'wallBundleShellTooOld',
  'host-too-old-for-bundle': 'wallHostTooOldForBundle',
  'bundle-too-old-for-host': 'wallBundleTooOldForHost'
} as const satisfies Record<MobileWebShellUpdateFailureWall, string>

function generation(buildId: string): string {
  return `${buildId.slice(0, BUILD_ID_PREFIX_LENGTH)}…`
}

function outcomeCopy(failure: MobileWebShellUpdateFailure): string {
  const outcome: MobileWebShellUpdateFailureOutcome = failure.outcome
  switch (outcome) {
    case 'opened-cached':
      return failure.cachedBuildId === null
        ? translate(diagnosticsCatalog, 'outcomeOpenedCached')
        : translate(diagnosticsCatalog, 'outcomeOpenedCachedGeneration', {
            generation: generation(failure.cachedBuildId)
          })
    case 'wall':
      return failure.wall === null
        ? translate(diagnosticsCatalog, 'outcomeWall')
        : translate(diagnosticsCatalog, 'outcomeWallReason', {
            reason: translate(diagnosticsCatalog, WALL_COPY[failure.wall])
          })
    case 'native-route':
      return translate(diagnosticsCatalog, 'outcomeNativeRoute')
    case 'failed':
      return translate(diagnosticsCatalog, 'outcomeFailed')
    case 'waiting':
      return translate(diagnosticsCatalog, 'outcomeWaiting')
  }
}

/** "Last update from Host 1 failed 12m ago: asset checksum mismatch (generation 3f2a…)." plus what
 *  the shell showed instead. */
export function formatUpdateFailure(
  failure: MobileWebShellUpdateFailure,
  hostName: string,
  now: number
): string {
  const reasonText = translate(
    diagnosticsCatalog,
    failure.hostCode === null ? REASON_COPY[failure.reason] : HOST_CODE_COPY[failure.hostCode]
  )
  const reason =
    failure.offeredBuildId === null
      ? reasonText
      : translate(diagnosticsCatalog, 'reasonWithGeneration', {
          reason: reasonText,
          generation: generation(failure.offeredBuildId)
        })
  // Same threshold as formatTimeAgo's "just now".
  const sentence =
    now - failure.at < 60_000
      ? translate(diagnosticsCatalog, 'updateFailedJustNow', { host: hostName, reason })
      : translate(diagnosticsCatalog, 'updateFailedAgo', {
          host: hostName,
          ago: formatTimeAgo(failure.at, now),
          reason
        })
  return `${sentence} ${outcomeCopy(failure)}`
}
