// Why: the Home host card finishes an update the desktop already found; updater.check stays desktop-only.
export const MOBILE_UPDATER_RPC_METHODS = [
  'updater.download',
  'updater.getStatus',
  'updater.install'
] as const
