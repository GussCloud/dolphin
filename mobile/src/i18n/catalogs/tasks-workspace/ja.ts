import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspaceJa: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: 'ローカルフック',
  setupSourceRepository: 'リポジトリのフック',

  // Workspace create drawer
  selectRepository: 'リポジトリを選択',
  sshConnection: 'SSH 接続',
  remoteRepository: 'リモートリポジトリ',
  connecting: '接続中...',
  workspaceName: 'ワークスペース名',
  optionalHint: '[任意]',
  agent: 'エージェント',
  connectRepositoryFirst: '先にリポジトリを接続してください',
  detectingAgents: 'エージェントを検出中...',
  advanced: '詳細設定',
  startFrom: '開始地点',
  defaultBranch: 'デフォルトブランチ',
  createFromRef: '{ref} から作成',
  linearWorkspaceNeedsRepository:
    'Linear のワークスペースを作成する前に Git リポジトリを追加してください。',
  repositoryNotFound: 'リポジトリが見つかりません。',
  connectRepository: 'リポジトリを接続',

  // Workspace option pickers
  startFromTitle: '開始地点',
  startFromSubtitle: '既存のブランチまたは ref を選択してください。',
  searchBranches: 'ブランチを検索',
  defaultBranchSubtitle: 'このリポジトリで設定されたベースを使用',
  noBranchesMatch: '一致するブランチはありません。',
  branchNameLabel: 'ブランチ名: {branch}',
  sparseCheckoutTitle: 'スパースチェックアウト',
  fullCheckout: '完全なチェックアウト',
  fullCheckoutSubtitle: 'リポジトリ全体を使用',
  editPresetLabel: '{name} を編集',
  newPreset: '新しいプリセット',

  // Sparse presets and setup trust
  newSparsePreset: '新しいスパースプリセット',
  editSparsePreset: 'スパースプリセットを編集',
  presetName: '名前',
  presetDirectories: 'ディレクトリ',
  directoryCount: { one: '{count} 件のディレクトリ', other: '{count} 件のディレクトリ' },
  runSetupScriptTitle: 'セットアップスクリプトを実行しますか？',
  setupChoiceRequired:
    'このワークスペースを作成する前に、{repo} のセットアップ方法を選択する必要があります。',
  runSetupAndCreate: 'セットアップを実行して作成',
  skipSetupAndCreate: 'セットアップをスキップして作成',
  setupScriptChanged: '{repo} のセットアップスクリプトが変更されました',
  runSetupFrom: '{repo} のセットアップを実行しますか？',
  setupTrustWarning:
    'このリポジトリの dolphin.yaml は、ワークスペースの開始前にお使いのマシンで実行されます。このリポジトリを信頼できる場合にのみ実行してください。',
  newSetupScript: '新しいセットアップスクリプト',
  setupScript: 'セットアップスクリプト',
  trustSetupScriptError: 'セットアップスクリプトを信頼できませんでした。',
  runHooks: 'フックを実行',
  alwaysTrustAndRun: '常に信頼して実行',
  dontRun: '実行しない',

  // Workspace create operations
  sshConnected: '接続済み',
  sshConnecting: '接続中',
  sshDeployingRelay: 'リレーをデプロイ中',
  sshReconnecting: '再接続中',
  sshAuthFailed: '認証に失敗しました',
  sshReconnectFailed: '再接続に失敗しました',
  sshConnectionFailed: '接続に失敗しました',
  sshDisconnected: '切断済み',
  agentLaunchUnsupportedWarning:
    'ワークスペースは作成されましたが、このコンピューターはスマートフォンからエージェントを起動できません。',
  agentLaunchFailedWarning:
    'ワークスペースは作成されましたが、エージェントが起動しませんでした: {reason}',
  searchFailed: '検索に失敗しました',
  sparseDirectoriesInvalid:
    'ルート、絶対パス、親ディレクトリ指定ではなく、リポジトリからの相対ディレクトリを使用してください。',
  sparseDirectoriesEmpty: 'ディレクトリを 1 つ以上追加してください。',
  unknownError: '不明なエラー',
  createWorkspaceError: 'ワークスペースを作成できませんでした',

  // Smart workspace source modes
  smartModeSmart: 'スマート',
  smartModeBranch: 'ブランチ',
  smartModeName: '名前',

  // Action errors
  resolveBaseBranchError: 'ベースブランチを解決できませんでした。',
  agentDisabled:
    '選択したエージェントは無効です。作成する前に有効なエージェントを選択してください。',
  nameRequired: '名前は必須です。',
  openShellSubtitle: 'シェルを開く',
  sparsePresetsLoadError: 'スパースプリセットを読み込めませんでした。',
  branchSearchError: 'ブランチを検索できませんでした。',
  sparsePresetSaveError: 'スパースプリセットを保存できませんでした。',
  sshStateReadError: 'SSH 接続の状態を読み取れませんでした。',
  sshConnectError: 'SSH リポジトリに接続できませんでした。',
  connectRepoBeforeWorkspace: 'ワークスペースを作成する前に {repo} を接続してください。',
  nameTooLong: '名前は 80 文字以内にしてください。',
  nameAlreadyExists: '「{name}」は既に存在します。',
  blankTerminal: '空のターミナル'
}
