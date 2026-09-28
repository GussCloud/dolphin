import { FORK_CLOUD_ORIGINS } from '../../../shared/fork-identity'
import { cleanCloudServiceOrigin } from '../../../shared/cloud-service-url'

export function resolvePushGatewayOrigin(env: NodeJS.ProcessEnv, packaged: boolean): string {
  return cleanCloudServiceOrigin(env.DOLPHIN_PUSH_GATEWAY_URL, !packaged) ?? FORK_CLOUD_ORIGINS.push
}
