import { defineMethod } from '../core'
import {
  saveOpenObserveContext,
  activateOpenObserveContext
} from '../../../openobserve/openobserve-cli-context'
import { getOpenObserveCliStatus } from '../../../openobserve/openobserve-cli-status'
import {
  OpenObserveSaveContext,
  OpenObserveActivateContext
} from '../../../../shared/rpc-contract/openobserve-params'

export const OPENOBSERVE_METHODS = [
  defineMethod({
    name: 'openObserve.status',
    params: null,
    handler: async () => getOpenObserveCliStatus()
  }),
  defineMethod({
    name: 'openObserve.saveContext',
    params: OpenObserveSaveContext,
    handler: async (params) => saveOpenObserveContext(params)
  }),
  defineMethod({
    name: 'openObserve.activateContext',
    params: OpenObserveActivateContext,
    handler: async (params) => activateOpenObserveContext(params.name)
  })
]
