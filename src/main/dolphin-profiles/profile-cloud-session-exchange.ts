import type {
  DolphinCloudCapabilities,
  DolphinCloudOrgSummary,
  DolphinProfileCloudSummary
} from '../../shared/dolphin-profiles'

export type DolphinCloudSessionExchangeResponse = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  cloud: DolphinProfileCloudSummary
  organizations?: DolphinCloudOrgSummary[]
  capabilities: DolphinCloudCapabilities
}
