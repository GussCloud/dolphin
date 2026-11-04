// Why: the lookup lives in shared so the CLI bundle can use it without importing main.
export {
  isCommandOnLocalPath,
  resolveCommandOnLocalPath,
  type ResolveCommandOptions
} from '../../shared/child-process/command-path-resolution'
