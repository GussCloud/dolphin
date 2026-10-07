import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { diagnosticsEn } from './en'

export const diagnosticsJa: MobileLocaleMessages<typeof diagnosticsEn> = {
  // Shared chrome
  back: '戻る',
  troubleshooting: 'トラブルシューティング',
  networkDiagnostics: 'ネットワーク診断',
  // Troubleshoot screen
  running: '実行中…',
  runAgain: 'もう一度実行',
  runDiagnostics: '診断を実行',
  viewNetworkDiagnostics: 'ネットワーク診断を表示',
  commonIssues: 'よくある問題',
  // Diagnostic checks
  checkPairedHosts: 'ペアリング済みホスト',
  checkPairedCount: { one: '{count} 台ペアリング済み', other: '{count} 台ペアリング済み' },
  checkPairedNone: 'なし — QR をスキャンしてペアリング',
  checkPairedReadError: 'ホストデータを読み取れませんでした',
  checkInternet: 'インターネット',
  checkInternetConnected: '接続済み',
  checkInternetUnexpected: '予期しない応答',
  checkInternetNone: '接続なし',
  checkReachableAt: '{endpoint} に到達可能',
  checkHosts: 'ホスト',
  checkHostsError: 'テストできませんでした',
  checkPlatform: 'プラットフォーム',
  cannotReach: '{endpoint} に到達できません',
  cannotReachTailscale: '{endpoint} に到達できません — Tailscale を確認してください',
  // Common issues: push notifications
  notifTitle: 'プッシュ通知',
  notifStep1:
    'システム設定で Dolphin の通知が許可され、集中モードやおやすみモードがオフになっていることを確認してください。',
  notifStep2:
    'モバイル通信や別の Wi-Fi ネットワークを試してください。切り替え後に通知が届く場合は、ネットワークが配信を遅らせている可能性があります。',
  // Common issues: different Wi-Fi
  wifiTitle: '異なる Wi-Fi ネットワーク',
  wifiStep1: '両方のデバイスが同じ LAN 上にある必要があります（Tailscale 経由の接続を除く）。',
  wifiStep2: 'イーサネットと Wi-Fi は同じサブネットにある必要があります。',
  wifiStep3: '両方のデバイスで Wi-Fi に再接続してみてください。',
  // Common issues: firewall
  firewallTitle: 'ファイアウォールがポート 6768 をブロック',
  firewallStep1: 'macOS: システム設定 → ネットワーク → ファイアウォール — Dolphin を許可。',
  firewallStep2:
    'Windows: Defender ファイアウォール → アプリを許可 — プライベートネットワークで Dolphin を有効化。',
  firewallStep3: 'Linux: sudo ufw allow 6768',
  firewallStep4:
    '企業や学校のネットワークは P2P をブロックすることがあります — 個人のテザリングを試してください。',
  // Common issues: desktop not running
  desktopTitle: 'デスクトップアプリが起動していない',
  desktopStep1: '接続を受け付けるには、デスクトップで Dolphin を開いておく必要があります。',
  desktopStep2: 'Dolphin を再起動してみてください — コンパニオンサーバーは起動時に開始されます。',
  desktopStep3: 'アップデート後は、QR コードで再ペアリングが必要な場合があります。',
  // Common issues: timeout
  timeoutTitle: '接続タイムアウト',
  timeoutStep1: 'スマートフォンの Wi-Fi 電波強度を確認してください。',
  timeoutStep2: 'ホスト一覧に戻り、ホストをタップして再試行してください。',
  timeoutStep3: 'タイムアウトが続く場合は、両方のアプリを再起動してください。',
  // Common issues: Tailscale
  tailscaleTitle: 'Tailscale ホストに到達できない',
  tailscaleStep1:
    '100.x.x.x や *.ts.net のようなホストアドレスは Tailscale 経由で接続します — オンのままにしてください。',
  tailscaleStep2:
    'iOS/Android ではトンネルが気づかないうちに停止することがあります。Tailscale アプリでオフにしてから再度オンにしてください。',
  tailscaleStep3:
    'デスクトップがスリープしておらず、tailnet で接続済みと表示されていることを確認してください。',
  tailscaleStep4:
    'Tailscale アプリをアップデートしてください — 最近のリリースで再接続の不具合が修正されています。',
  // Common issues: other VPNs
  vpnTitle: '他の VPN による干渉',
  vpnStep1: 'Tailscale 以外の VPN は、ローカル通信をリモートサーバー経由にすることがあります。',
  vpnStep2: 'その VPN を無効にするか、スプリットトンネリング /「LAN を許可」を有効にしてください。',
  // Network diagnostics screen
  stateConnecting: '接続中',
  stateHandshaking: 'ハンドシェイク中',
  stateConnected: '接続済み',
  stateDisconnected: '切断',
  stateReconnecting: '再接続中',
  stateAuthFailed: '認証に失敗',
  stateWithAttempt: '{state} · 試行 {attempt} 回目',
  copied: 'コピーしました',
  copyReport: 'レポートをコピー',
  whatThisSuggests: '考えられる原因',
  sendPrivacyHint:
    'ホスト名、エンドポイント、バージョン、接続状態、イベントを含む、サイズ制限付きで秘匿化されたレポートを送信します。ターミナルの内容や認証情報は含まれません。',
  sending: '送信中…',
  diagnosticsSent: '診断情報を送信しました',
  retrySending: '再送信',
  sendDiagnostics: '診断情報を Dolphin に送信',
  noEvents: '接続イベントはまだありません。アプリがこのホストに接続するとイベントが表示されます。',
  noPairedHosts: 'ペアリング済みのホストはありません。',
  // Connection diagnosis (the shareable report renders these in English)
  causeHealthy: '接続は正常です。',
  causeHealthyVia: '{path} 経由の接続は正常です。',
  nextNoAction: '対応は不要です。',
  pathTailscaleDirect: 'Tailscale/直接',
  pathLanDirect: 'LAN/直接',
  causeBeforeNetworkChange: '前回のネットワーク変更より前: {cause}',
  causeBeforeResume: 'アプリが前回再開する前: {cause}',
  causeRelayCredentialRejected: 'Relay が保存済みの再開用認証情報を拒否しました。',
  nextRelayCredentialRejected:
    '直接接続を試してください。Relay が 401 を返し続ける場合は、このデバイスを再ペアリングしてください。',
  causeRelayUnavailable: 'Relay サービスが一時的に利用できませんでした。',
  causeRelayUnavailableRetry:
    'Relay サービスが一時的に利用できず、{delay} 後に再試行するよう Dolphin に求めました。',
  nextRelayUnavailable: 'Dolphin を開いたままにしてください。復旧は自動的に再試行されます。',
  delaySeconds: '{seconds} 秒',
  delayMinutes: '{minutes} 分',
  causeRelayLiveness: 'Relay が認証済みのヘルスチェックに応答しなくなりました。',
  causeHostLiveness: '接続中のホストが認証済みのヘルスチェックに応答しなくなりました。',
  nextLiveness: 'Dolphin は古いセッションを閉じて復旧を開始しました。',
  causeRelaySessionFailed: 'アクティブな Relay セッションが予期せず終了しました。',
  nextRelaySessionFailed:
    'Dolphin は Relay の復旧を開始しました。イベント履歴にセルの終了理由が含まれています。',
  causeAuthRejected: 'デスクトップが認証中にこのデバイスを拒否しました。',
  nextAuthRejected:
    'デバイスがまだペアリングされていることを確認してください。拒否が続く場合は再ペアリングしてください。',
  causeTailscaleTimeout:
    '保存された Tailscale エンドポイントが接続タイムアウトまでに応答しませんでした。',
  causeDirectTimeout:
    '保存された直接接続エンドポイントが接続タイムアウトまでに応答しませんでした。',
  nextRelayRecoveryInProgress:
    'Relay の復旧が進行中です。再試行中は Dolphin を開いたままにしてください。',
  nextCheckNetwork:
    'ローカル/VPN ネットワークを確認し、デスクトップがスリープしていないことを確認してください。',
  causeHandshakeTimeout:
    'エンドポイントは開きましたが、暗号化された Dolphin のハンドシェイクが完了しませんでした。',
  nextHandshakeTimeout:
    'デスクトップで互換性のある Dolphin バージョンが動作していることを確認して、再試行してください。',
  causeRelayRecoveryPending:
    'Relay による復旧が選択されていますが、より具体的な失敗はまだ記録されていません。',
  nextRelayRecoveryPending:
    '次の復旧イベントが記録されるまで、このページを開いたままにしてください。',
  causeUnknown: '記録されたイベントから単一の失敗原因を特定できません。',
  nextUnknown: '診断を実行し、次の接続試行後にもう一度レポートをコピーしてください。',
  causeRelayHostOffline:
    'Relay は応答しましたが、デスクトップが接続されていません（クローズコード {code}、ホストはオフライン）。',
  nextRelayHostOffline:
    'デスクトップがスリープしておらず、Dolphin が起動し、Dolphin Cloud にサインインしていることを確認してください。',
  causeRelayCredentialRefused:
    'Relay がこのデバイスの relay 認証情報を拒否しました（クローズコード {code}）。',
  nextRelayCredentialRefused: 'このスマートフォンをデスクトップと再ペアリングしてください。',
  causeRelayUnreachable:
    'スマートフォンが Relay セルに到達できませんでした（トランスポートクローズ {code}）。',
  nextRelayUnreachable:
    'このスマートフォンのネットワーク接続を確認してください。Relay の復旧は自動的に再試行されます。',
  causeRelayConnecting:
    'Relay がコード {code} で接続を閉じました。復旧処理が再解決して再試行します。',
  nextRelayConnecting: 'Relay の復旧が再試行している間は Dolphin を開いたままにしてください。',
  causeRelayDialNoAnswer: 'セルが応答する前に Relay への接続が失敗しました。',
  // Developer and OTA rows
  hybridShellDevelopmentBuild: 'ハイブリッドシェル（開発ビルド）',
  hybridShellOtaBuild: 'ハイブリッドシェル（OTA ビルド）',
  openHybridShell: '最初にペアリングしたホストのハイブリッドシェルを開く',
  workspaceUpdates: 'ワークスペースの更新',
  // Workspace update failures
  updateFailedAgo: '{host} からの前回のアップデートは {ago}前に失敗しました: {reason}。',
  updateFailedJustNow: '{host} からの前回のアップデートがたった今失敗しました: {reason}。',
  reasonWithGeneration: '{reason}（世代 {generation}）',
  outcomeOpenedCached: '保存済みのバージョンにフォールバックしました。',
  outcomeOpenedCachedGeneration:
    '保存済みのバージョンにフォールバックしました（世代 {generation}）。',
  outcomeWall: 'ワークスペースをブロックしました。',
  outcomeWallReason: 'ブロック: {reason}。',
  outcomeNativeRoute: 'ネイティブ画面を表示しました。',
  outcomeFailed: 'エラー画面を表示しました。',
  outcomeWaiting: 'ホストを待機しました。',
  reasonNoConnection: 'ホストに接続されていない',
  reasonConnectionLost: '接続が切断された',
  reasonHostRefused: 'ホストが読み取りを拒否した',
  reasonReplyUnreadable: 'このアプリが読み取れない応答をホストが送信した',
  reasonChunkOversize: 'チャンクがホストの許容サイズを超えていた',
  reasonAssetOverlong: 'アセットがマニフェストの宣言より長かった',
  reasonAssetNoProgress: 'アセットの読み取りが進まなかった',
  reasonAssetShort: 'アセットが宣言サイズに達する前に終了した',
  reasonAssetChecksumMismatch: 'アセットのチェックサムが一致しない',
  reasonBuildChangedMidFetch: 'ダウンロード中にホストのビルドが変更された',
  reasonChunkMisrouted: 'チャンクが誤ったアセットまたはオフセットに応答した',
  reasonAssetEntryChanged: 'アセットがマニフェストと一致しなくなった',
  reasonRangeUndecodable: '圧縮された読み取りをデコードできなかった',
  reasonFetchStopped: 'ダウンロードが停止された',
  reasonCacheWriteFailed: 'このスマートフォンへのダウンロードの保存に失敗した',
  reasonUnrecognisedError: '認識できないエラー',
  hostCodeUnavailable: 'ホストにワークスペースバンドルがない',
  hostCodeBuildChanged: 'ダウンロード中にホストのビルドが変更された',
  hostCodeAssetUnknown: 'ホストがアセットを認識しなかった',
  hostCodeAssetChanged: 'ホスト上のアセットが変更された',
  hostCodeOffsetInvalid: 'ホストが読み取りオフセットを拒否した',
  hostCodeReadLimited: 'ホストが同時読み取りを制限した',
  wallBundleUnavailable: 'ホストにワークスペースバンドルがない',
  wallBundleShellTooOld: 'このアプリは保存済みバンドルに対して古すぎる',
  wallHostTooOldForBundle: 'ホストは保存済みバンドルに対して古すぎる',
  wallBundleTooOldForHost: '保存済みバンドルはホストに対して古すぎる'
}
