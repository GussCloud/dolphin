import { track } from '@/lib/telemetry'
import type { EventProps } from '../../../../shared/telemetry-events'

export type DolphinCliFeatureTipSource = EventProps<'dolphin_cli_feature_tip_shown'>['source']
export type DolphinCliFeatureTipSetupResult =
  EventProps<'dolphin_cli_feature_tip_setup_result'>['result']
export type CmdJPaletteFeatureTipSource = EventProps<'cmd_j_palette_feature_tip_shown'>['source']

export function getDolphinCliFeatureTipTelemetrySource(value: unknown): DolphinCliFeatureTipSource {
  return value === 'app_open' ? 'app_open' : 'manual'
}

export function trackDolphinCliFeatureTipShown(source: DolphinCliFeatureTipSource): void {
  track('dolphin_cli_feature_tip_shown', { source })
}

export function trackDolphinCliFeatureTipSetupClicked(source: DolphinCliFeatureTipSource): void {
  track('dolphin_cli_feature_tip_setup_clicked', { source })
}

export function trackDolphinCliFeatureTipSetupResult(
  source: DolphinCliFeatureTipSource,
  result: DolphinCliFeatureTipSetupResult
): void {
  track('dolphin_cli_feature_tip_setup_result', { source, result })
}

export function trackCmdJPaletteFeatureTipShown(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_shown', { source })
}

export function trackCmdJPaletteFeatureTipAcknowledged(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_acknowledged', { source })
}
