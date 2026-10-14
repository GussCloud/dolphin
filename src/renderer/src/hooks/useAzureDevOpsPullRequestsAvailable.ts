import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { useAppStore } from '@/store'

// Why: gate on "configured with an organization", not "authenticated", so an expired
// `az login` keeps the menu and the page explains how to sign in again.
export function useAzureDevOpsPullRequestsAvailable(): boolean {
  return useAppStore((state) => {
    if (
      !state.preflightStatusChecked ||
      state.preflightStatusError !== null ||
      state.preflightStatusContextKey !== localPreflightContextKey(getLocalPreflightContext(state))
    ) {
      return false
    }
    const azureDevOps = state.preflightStatus?.azureDevOps
    return azureDevOps?.configured === true && Boolean(azureDevOps.baseUrl)
  })
}
