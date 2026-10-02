import type {
  OpenObserveCliStatus,
  OpenObserveCommandResult,
  OpenObserveSaveContextInput
} from '../../shared/openobserve-cli'

export type OpenObserveApi = {
  status: () => Promise<OpenObserveCliStatus>
  saveContext: (input: OpenObserveSaveContextInput) => Promise<OpenObserveCommandResult>
  activateContext: (name: string) => Promise<OpenObserveCommandResult>
}
