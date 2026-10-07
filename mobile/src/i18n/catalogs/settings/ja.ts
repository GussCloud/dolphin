import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { settingsEn } from './en'

export const settingsJa: MobileLocaleMessages<typeof settingsEn> = {
  back: '戻る',
  on: 'オン',
  off: 'オフ',
  retry: '再試行',
  openSettings: '設定を開く',

  settings: '設定',
  terminal: 'ターミナル',
  chatUi: 'Chat UI',
  browser: 'ブラウザ',
  voice: '音声',
  notifications: '通知',
  backgroundConnection: 'バックグラウンド接続',
  language: '言語',
  troubleshooting: 'トラブルシューティング',
  about: 'このアプリについて',
  privacyPolicy: 'プライバシーポリシー',
  support: 'サポート',

  languageHeading: 'アプリの言語',
  languageDescription: 'このデバイスで Dolphin アプリに使用する言語を選択します。',
  languageSystemDefault: 'システムのデフォルト',
  languageSaveError: '言語を保存できませんでした。もう一度お試しください。',

  aboutTagline: '100x ビルダーのためのオープンソースのエージェント IDE',
  aboutWebsite: 'Dolphin ウェブサイト',
  aboutSourceCode: 'Dolphin ソースコード',
  aboutOnX: 'X の Dolphin',
  aboutOpenLinkError: 'リンクを開けませんでした。もう一度お試しください。',

  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    'アプリを離れた後も Relay 接続を開いたままにし、すぐに再開できるようにします。オンの間は Android に常駐通知が表示され、バッテリー消費が増えます。',
  backgroundStayConnected: 'バックグラウンドで接続を維持',
  backgroundRetentionOffSubtitle: 'アプリを離れてしばらくすると切断します。',
  backgroundRetention15m: '15 分',
  backgroundRetention15mSubtitle: 'バックグラウンドで 15 分間接続を維持します。',
  backgroundRetention1h: '1 時間',
  backgroundRetention1hSubtitle: 'バックグラウンドで 1 時間接続を維持します。',
  backgroundRetentionAlways: '常に',
  backgroundRetentionAlwaysSubtitle: 'オフにするまで接続を維持します。',
  backgroundSaveError: 'バックグラウンド接続を保存できませんでした。もう一度お試しください。',
  backgroundSystemHeading: 'システム',
  backgroundSystemDescription:
    'バッテリー節約機能によって接続が切断されることがあります。Dolphin の動作を無制限に許可してください。',
  backgroundSystemDescriptionWithAutostart:
    'バッテリー節約機能によって接続が切断されることがあります。Dolphin の動作を無制限に許可し、自動起動を有効にしてください。',
  backgroundBatteryOptimization: 'バッテリーの最適化',
  backgroundUnrestricted: '制限なし',
  backgroundRestricted: '制限あり — タップして許可',
  backgroundAutostart: '自動起動',
  backgroundAutostartHint: 'Xiaomi、Redmi、POCO で必要です',

  browserLinksHeading: 'リンク',
  browserLinksDescription: 'ターミナル出力でタップした HTTP(S) リンクを開く場所を選択します。',
  browserOpenTerminalLinks: 'ターミナルのリンクを開く',
  browserModeDolphin: 'デスクトップの Dolphin ブラウザ',
  browserModeDolphinSubtitle:
    'ペアリング済みデスクトップからストリーミングされるブラウザで開きます。',
  browserModePhone: 'スマートフォンのブラウザ',
  browserModePhoneSubtitle: 'このスマートフォンの Safari、Chrome などのブラウザで開きます。',
  browserLoadError: 'ブラウザの設定を読み込めませんでした。もう一度お試しください。',
  browserSaveError: 'ブラウザの設定を保存できませんでした。もう一度お試しください。',

  chatDefaultViewHeading: 'デフォルトの表示',
  chatDefaultViewDescription:
    '対応するエージェントセッション（Claude、Codex などチャット対応のエージェント）をこのデバイスでどう開くかを選択します。ターミナルは CLI をそのまま表示し、Chat UI はデスクトップアプリのようなチャット画面を表示します。個々のセッションは長押しメニューからいつでも切り替えられます。',
  chatOpenSessionsInChatUi: 'セッションを Chat UI で開く',

  notificationsEnable: '通知を有効にする',
  notificationsDefaultDescription:
    'エージェントが入力を必要としたときやタスクを完了したときに、このデバイスに通知します。',
  notificationsPushDescription:
    'アプリを閉じていてもエージェントのアラートを受け取れます。Dolphin のプッシュサービスと Apple または Google を通じて配信されます。',
  notificationsBlocked: 'システム設定で通知がオフになっています。',
  notificationsLoadError: '通知設定を読み込めませんでした。もう一度お試しください。',
  notificationsSaveError: '通知設定を保存できませんでした。もう一度お試しください。',
  notificationsOpenSettingsError: 'システム設定を開けませんでした。もう一度お試しください。',
  deliveryLoadError: '配信設定を読み込めませんでした。この画面を開き直して再試行してください。',
  deliverySaveError: '配信設定を保存できませんでした。もう一度お試しください。',
  deliveryNeedsUpdatedDesktop:
    'このスマートフォンで通知を受け取るには、最新のデスクトップとペアリングしてください。',

  pushTestHeading: 'アラートが届きませんか？',
  pushTestDetail: 'Dolphin のプッシュサービス経由でテストを送信します。',
  pushTestSend: 'テスト通知を送信',
  pushTestSending: '送信中…',
  pushTestLoadHostsError: 'ペアリング済みのデスクトップを読み込めませんでした。',
  pushTestPairDesktop: 'デスクトップとペアリングしてから、もう一度お試しください。',
  pushTestConnectDesktop: 'デスクトップに接続してから、もう一度お試しください。',
  pushTestUpdateDesktop: 'このテストを実行するにはデスクトップを更新してください。',
  pushTestReachError: 'デスクトップに接続できませんでした。もう一度お試しください。',
  pushTestAccepted:
    'Dolphin のプッシュサービスが受け付けました。通知が届いているか確認してください。',
  pushTestNotRegistered: '再接続して、このスマートフォンを通知用に登録してください。',
  pushTestRateLimited: '通知が多すぎます。しばらくしてからお試しください。',
  pushTestSendError:
    'Dolphin のプッシュサービス経由で送信できませんでした。もう一度お試しください。',
  pushTestGenericError: 'プッシュテストを送信できませんでした。',

  credentialCleanupTitle: 'ペアリング認証情報のクリーンアップ',
  credentialCleanupRetryFailed:
    'クリーンアップをまだ確認できません。しばらくしてからお試しください。',
  credentialCleanupPending: {
    one: 'このデバイスで {count} 件の認証情報のクリーンアップを確認できませんでした。',
    other: 'このデバイスで {count} 件の認証情報のクリーンアップを確認できませんでした。'
  },
  credentialCleanupUnreadable:
    'このデバイスでクリーンアップの状態を確認できませんでした。念のため再試行してください。',
  credentialCleanupRetryLabel: 'ペアリング認証情報の削除を再試行',

  voiceConnectDesktop: '音声設定を管理するにはデスクトップに接続してください。',
  voiceLoadError: '音声設定を読み込めませんでした。',
  voiceUpdateError: '更新できませんでした。',
  voiceSelectModelError: 'モデルを選択できませんでした。',
  voiceDownloadError: 'ダウンロードに失敗しました。',
  voiceDeleteError: '削除に失敗しました。',
  voiceDictationHeading: 'ディクテーション',
  voiceEnableDictation: '音声ディクテーションを有効にする',
  voiceEnableDictationDescription:
    'デスクトップでフォーカスしている任意のペインにテキストを音声入力します。',
  voiceDictationMode: 'ディクテーションモード',
  voiceDictationModeDescription:
    'トグル：1 回押すと開始し、もう一度押すと停止します。ホールド：押している間だけ音声入力します。',
  voiceModeToggle: 'トグル',
  voiceModeHold: 'ホールド',
  voiceSpeechModelHeading: '音声モデル',
  voiceSpeechModel: '音声モデル',
  voiceNoModelSelected: '未選択',

  terminalLeaveHeading: 'アプリを離れたとき',
  terminalLeaveDescription:
    'スマートフォンでターミナルを使っている間、Dolphin は画面に合わせてターミナルを縮小します。アプリを閉じたり切り替えたりしたときに、スマートフォンのサイズのままにするか（対話型の CLI ツールが再描画されないように）、デスクトップのサイズに戻すかをここで設定します。バナーの「このターミナルを復元」または「すべてのターミナルを復元」を使って、いつでも手動でサイズを戻せます。',
  terminalNoHosts:
    'ペアリング済みのデスクトップがまだありません。ターミナルの動作を設定するにはペアリングしてください。',
  terminalRestoreKeepPhoneSize: 'スマートフォンのサイズのまま（デフォルト）',
  terminalRestoreAfter1Minute: '1 分後',
  terminalRestoreAfter5Minutes: '5 分後',
  terminalRestoreAfter30Minutes: '30 分後',
  terminalRestoreAfterSeconds: '{seconds} 秒後',
  terminalRestorePickerTitle: '{host} を復元',
  terminalTextSizeHeading: '文字サイズ',
  terminalTextSizeDescription:
    'ターミナルの文字を拡大・縮小します。小さいサイズでは左右に余白を残してより多くの列が収まり、大きいサイズでは列が少なくなります — 横にドラッグしてスクロールできます。ターミナル上でピンチしてズームすることもでき、この設定に反映されます。このデバイスの表示のみに適用され、デスクトップのターミナルは変わりません。',
  terminalTextSize: '文字サイズ',
  terminalTextSizePickerTitle: 'ターミナルの文字サイズ',
  terminalTextSizeSmallest: '最小 (50%)',
  terminalTextSizeSmaller: '小 (75%)',
  terminalTextSizeDefault: 'デフォルト (100%)',
  terminalTextSizeLarge: '大 (125%)',
  terminalTextSizeLarger: '特大 (150%)',
  terminalTextSizeLargest: '最大 (200%)',
  terminalKeyboardHeading: 'キーボード入力',
  terminalKeyboardDescription:
    'ターミナルのコマンドバーで、スマートフォンの予測変換・自動修正・スペル候補を有効にします。キーボードがコマンド、フラグ、パスを書き換えないよう、デフォルトではオフです。キーボードの直接入力（キーが直接ターミナルに送られるとき）は常にそのままのキー入力を送るため、候補は適用されません。',
  terminalAutocomplete: '予測変換と自動修正'
}
