import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const hostRoutesEn = {
  // Route titles
  routeHost: 'Host',
  routeAccounts: 'Accounts',
  routeTasks: 'Tasks',
  routeTerminal: 'Terminal',
  routeSourceControl: 'Source Control',
  routeAgentHistory: 'Agent Session History',
  routeChanges: 'Changes',
  routePullRequest: 'Pull Request',
  routeWorkspace: 'Workspace',

  // Edit host
  editHost: 'Edit host',
  back: 'Back',
  save: 'Save',
  saveHostA11y: 'Save host',
  goBack: 'Go back',
  missingHost: 'Missing host.',
  hostRemoved: 'This host was removed from this phone.',
  failedToLoadHost: 'Failed to load host.',
  failedToSaveHost: 'Failed to save host.',
  editHelp:
    'Change the display name or connection address. Leave the name empty to use the name the desktop reports. Address edits only switch where this phone connects — they do not re-pair. Use this when the same desktop is reachable at a different IP (for example home LAN vs Tailscale).',
  name: 'Name',
  hostNamePlaceholder: 'Host name',
  address: 'Address',
  addressHint:
    'Accepts IP, host:port, or ws:// / wss://. Missing port defaults to the current port (or 6768).',
  connectsTo: 'Connects to {endpoint}',

  // Accounts
  accounts: 'Accounts',
  invalidSnapshot: 'Invalid accounts snapshot from host',
  hostNotFound: 'Host not found',
  couldNotSwitchAccount: 'Could not switch account',
  systemDefault: 'System default',
  useAgentLogin: "Use the agent's own login",
  connectingToHost: 'Connecting to {host}…',
  connectingToHostGeneric: 'Connecting to host…',
  loadingAccounts: 'Loading accounts…',
  addAccountsHint: 'Add or re-authenticate accounts from desktop Settings → Accounts.'
} as const satisfies MobileCatalogSource
