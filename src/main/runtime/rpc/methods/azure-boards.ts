import { defineMethod } from '../core'
import { azureBoardsCommands } from '../../../azure-boards/azure-boards-commands'
import {
  AzureBoardsAddComment,
  AzureBoardsCreate,
  AzureBoardsGet,
  AzureBoardsList,
  AzureBoardsProject,
  AzureBoardsUpdateState
} from '../../../../shared/rpc-contract/azure-boards-params'

export const AZURE_BOARDS_METHODS = [
  defineMethod({
    name: 'azureBoards.scope',
    params: null,
    handler: async () => azureBoardsCommands.scope()
  }),
  defineMethod({
    name: 'azureBoards.list',
    params: AzureBoardsList,
    handler: async (params) => azureBoardsCommands.list(params)
  }),
  defineMethod({
    name: 'azureBoards.get',
    params: AzureBoardsGet,
    handler: async (params) => azureBoardsCommands.get(params)
  }),
  defineMethod({
    name: 'azureBoards.types',
    params: AzureBoardsProject,
    handler: async (params) => azureBoardsCommands.types(params)
  }),
  defineMethod({
    name: 'azureBoards.create',
    params: AzureBoardsCreate,
    handler: async (params) => azureBoardsCommands.create(params)
  }),
  defineMethod({
    name: 'azureBoards.updateState',
    params: AzureBoardsUpdateState,
    handler: async (params) => azureBoardsCommands.updateState(params)
  }),
  defineMethod({
    name: 'azureBoards.addComment',
    params: AzureBoardsAddComment,
    handler: async (params) => azureBoardsCommands.addComment(params)
  })
]
