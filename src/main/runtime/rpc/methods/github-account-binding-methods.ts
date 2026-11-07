import { defineMethod } from '../core'
import { listGhAccountBindingInventory } from '../../../github/gh-account-binding-inventory'
import {
  BindableAccounts,
  HostAccounts,
  ValidateAccountBinding
} from '../../../../shared/rpc-contract/github-account-binding-params'

export const GITHUB_ACCOUNT_BINDING_METHODS = [
  defineMethod({
    name: 'github.listBindableAccounts',
    params: BindableAccounts,
    handler: async (params, { runtime }) =>
      runtime.listGitHubBindableAccounts(params.repo, {
        refreshCapability: params.refreshCapability
      })
  }),
  defineMethod({
    name: 'github.listHostAccounts',
    params: HostAccounts,
    handler: async (params) =>
      listGhAccountBindingInventory(params.wslDistro ? { wslDistro: params.wslDistro } : {}, {
        refreshCapability: params.refreshCapability === true,
        ...(params.host ? { requiredHost: params.host } : {})
      })
  }),
  defineMethod({
    name: 'github.validateAccountBinding',
    params: ValidateAccountBinding,
    handler: async (params, { runtime }) =>
      runtime.validateGitHubAccountBinding(params.repo, {
        host: params.host,
        user: params.user
      })
  })
]
