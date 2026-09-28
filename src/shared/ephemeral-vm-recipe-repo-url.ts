import { stripCredentialsFromMessage } from './git-remote-error'
import type { DolphinVmRecipe } from './dolphin-yaml-hook-types'

export function getProvisionedRootRecipeRepoUrl(
  checkoutMode: DolphinVmRecipe['checkoutMode'],
  remoteUrl: string | undefined
): string | undefined {
  if (checkoutMode !== 'provisioned-root' || !remoteUrl) {
    return undefined
  }
  return stripCredentialsFromMessage(remoteUrl)
}
