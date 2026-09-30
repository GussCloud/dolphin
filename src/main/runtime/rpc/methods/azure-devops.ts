import { defineMethod } from '../core'
import {
  changeAzureDevOpsAuthMethod,
  listAzureDevOpsRepositoriesResult,
  refreshAzureCliSession,
  setAzureCliAutoRenew,
  setAzureDevOpsCliDefaults
} from '../../../azure-devops/azure-devops-auth-commands'
import {
  AzureDevOpsConfigureCliDefaults,
  AzureDevOpsSetAuthMethod,
  AzureDevOpsSetCliAutoRenew
} from '../../../../shared/rpc-contract/azure-devops-params'

export const AZURE_DEVOPS_METHODS = [
  defineMethod({
    name: 'azureDevOps.setAuthMethod',
    params: AzureDevOpsSetAuthMethod,
    handler: async (params) => changeAzureDevOpsAuthMethod(params.method)
  }),
  defineMethod({
    name: 'azureDevOps.configureCliDefaults',
    params: AzureDevOpsConfigureCliDefaults,
    handler: async (params) => setAzureDevOpsCliDefaults(params)
  }),
  defineMethod({
    name: 'azureDevOps.setCliAutoRenew',
    params: AzureDevOpsSetCliAutoRenew,
    handler: async (params) => setAzureCliAutoRenew(params.enabled)
  }),
  defineMethod({
    name: 'azureDevOps.refreshCliSession',
    params: null,
    handler: async () => refreshAzureCliSession()
  }),
  defineMethod({
    name: 'azureDevOps.listRepositories',
    params: null,
    handler: async () => listAzureDevOpsRepositoriesResult()
  })
]
