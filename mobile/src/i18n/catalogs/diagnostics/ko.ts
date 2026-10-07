import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { diagnosticsEn } from './en'

export const diagnosticsKo: MobileLocaleMessages<typeof diagnosticsEn> = {
  // Shared chrome
  back: '뒤로',
  troubleshooting: '문제 해결',
  networkDiagnostics: '네트워크 진단',
  // Troubleshoot screen
  running: '실행 중…',
  runAgain: '다시 실행',
  runDiagnostics: '진단 실행',
  viewNetworkDiagnostics: '네트워크 진단 보기',
  commonIssues: '자주 발생하는 문제',
  // Diagnostic checks
  checkPairedHosts: '페어링된 호스트',
  checkPairedCount: { one: '{count}개 페어링됨', other: '{count}개 페어링됨' },
  checkPairedNone: '없음 — QR을 스캔해 페어링하세요',
  checkPairedReadError: '호스트 데이터를 읽을 수 없음',
  checkInternet: '인터넷',
  checkInternetConnected: '연결됨',
  checkInternetUnexpected: '예기치 않은 응답',
  checkInternetNone: '연결 없음',
  checkReachableAt: '{endpoint}에서 연결 가능',
  checkHosts: '호스트',
  checkHostsError: '테스트할 수 없음',
  checkPlatform: '플랫폼',
  cannotReach: '{endpoint}에 연결할 수 없음',
  cannotReachTailscale: '{endpoint}에 연결할 수 없음 — Tailscale을 확인하세요',
  // Common issues: push notifications
  notifTitle: '푸시 알림',
  notifStep1:
    '시스템 설정에서 Dolphin 알림이 허용되어 있고 집중 모드나 방해 금지 모드가 꺼져 있는지 확인하세요.',
  notifStep2:
    '셀룰러나 다른 Wi-Fi 네트워크를 사용해 보세요. 전환 후 알림이 도착한다면 네트워크가 전송을 지연시키고 있을 수 있습니다.',
  // Common issues: different Wi-Fi
  wifiTitle: '서로 다른 Wi-Fi 네트워크',
  wifiStep1: '두 기기가 같은 LAN에 있어야 합니다(Tailscale로 연결한 경우 제외).',
  wifiStep2: '이더넷과 Wi-Fi가 같은 서브넷에 있어야 합니다.',
  wifiStep3: '두 기기 모두에서 Wi-Fi를 다시 연결해 보세요.',
  // Common issues: firewall
  firewallTitle: '방화벽이 포트 6768을 차단함',
  firewallStep1: 'macOS: 시스템 설정 → 네트워크 → 방화벽 — Dolphin 허용.',
  firewallStep2: 'Windows: Defender 방화벽 → 앱 허용 — 개인 네트워크에서 Dolphin 사용.',
  firewallStep3: 'Linux: sudo ufw allow 6768',
  firewallStep4: '회사/학교 네트워크는 P2P를 차단할 수 있습니다 — 개인 핫스팟을 사용해 보세요.',
  // Common issues: desktop not running
  desktopTitle: '데스크톱 앱이 실행 중이 아님',
  desktopStep1: '연결을 받으려면 데스크톱에서 Dolphin이 열려 있어야 합니다.',
  desktopStep2: 'Dolphin을 다시 시작해 보세요 — 컴패니언 서버는 실행 시 시작됩니다.',
  desktopStep3: '업데이트 후에는 QR 코드로 다시 페어링해야 할 수 있습니다.',
  // Common issues: timeout
  timeoutTitle: '연결 시간 초과',
  timeoutStep1: '휴대폰의 Wi-Fi 신호 세기를 확인하세요.',
  timeoutStep2: '호스트 목록으로 돌아가 호스트를 탭해 다시 시도하세요.',
  timeoutStep3: '시간 초과가 계속되면 두 앱을 모두 다시 시작하세요.',
  // Common issues: Tailscale
  tailscaleTitle: 'Tailscale 호스트에 연결할 수 없음',
  tailscaleStep1:
    '100.x.x.x나 *.ts.net 같은 호스트 주소는 Tailscale을 통해 연결됩니다 — 켜 두세요.',
  tailscaleStep2:
    'iOS/Android에서 터널이 조용히 멈출 수 있습니다. Tailscale 앱에서 Tailscale을 껐다가 다시 켜세요.',
  tailscaleStep3: '데스크톱이 깨어 있고 tailnet에서 연결됨으로 표시되는지 확인하세요.',
  tailscaleStep4: 'Tailscale 앱을 업데이트하세요 — 최신 버전에서 재연결 버그가 수정되었습니다.',
  // Common issues: other VPNs
  vpnTitle: '다른 VPN의 간섭',
  vpnStep1: 'Tailscale이 아닌 VPN은 로컬 트래픽을 원격 서버로 우회시킬 수 있습니다.',
  vpnStep2: '해당 VPN을 끄거나 분할 터널링 / "LAN 허용"을 켜세요.',
  // Network diagnostics screen
  stateConnecting: '연결 중',
  stateHandshaking: '핸드셰이크 중',
  stateConnected: '연결됨',
  stateDisconnected: '연결 끊김',
  stateReconnecting: '다시 연결 중',
  stateAuthFailed: '인증 실패',
  stateWithAttempt: '{state} · {attempt}번째 시도',
  copied: '복사됨',
  copyReport: '보고서 복사',
  whatThisSuggests: '진단 결과',
  sendPrivacyHint:
    '호스트 이름, 엔드포인트, 버전, 연결 상태, 이벤트가 포함된 크기 제한 및 개인정보 삭제 보고서를 보냅니다. 터미널 내용이나 자격 증명은 절대 포함되지 않습니다.',
  sending: '보내는 중…',
  diagnosticsSent: '진단 정보 전송됨',
  retrySending: '다시 보내기',
  sendDiagnostics: 'Dolphin에 진단 정보 보내기',
  noEvents: '아직 연결 이벤트가 없습니다. 앱이 이 호스트에 연결을 시도하면 이벤트가 표시됩니다.',
  noPairedHosts: '페어링된 호스트가 없습니다.',
  // Connection diagnosis (the shareable report renders these in English)
  causeHealthy: '연결이 정상입니다.',
  causeHealthyVia: '{path}을(를) 통한 연결이 정상입니다.',
  nextNoAction: '조치가 필요하지 않습니다.',
  pathTailscaleDirect: 'Tailscale/직접',
  pathLanDirect: 'LAN/직접',
  causeBeforeNetworkChange: '마지막 네트워크 변경 전: {cause}',
  causeBeforeResume: '앱이 마지막으로 다시 열리기 전: {cause}',
  causeRelayCredentialRejected: 'Relay가 저장된 재개 자격 증명을 거부했습니다.',
  nextRelayCredentialRejected:
    '직접 연결을 시도하세요. Relay가 계속 401을 반환하면 이 기기를 다시 페어링하세요.',
  causeRelayUnavailable: 'Relay 서비스를 일시적으로 사용할 수 없었습니다.',
  causeRelayUnavailableRetry:
    'Relay 서비스를 일시적으로 사용할 수 없어 Dolphin에 {delay} 후 다시 시도하도록 요청했습니다.',
  nextRelayUnavailable: 'Dolphin을 열어 두세요. 복구가 자동으로 다시 시도됩니다.',
  delaySeconds: '{seconds}초',
  delayMinutes: '{minutes}분',
  causeRelayLiveness: 'Relay가 인증된 상태 확인에 더 이상 응답하지 않았습니다.',
  causeHostLiveness: '연결된 호스트가 인증된 상태 확인에 더 이상 응답하지 않았습니다.',
  nextLiveness: 'Dolphin이 오래된 세션을 닫고 복구를 시작했습니다.',
  causeRelaySessionFailed: '활성 Relay 세션이 예기치 않게 닫혔습니다.',
  nextRelaySessionFailed:
    'Dolphin이 Relay 복구를 시작했습니다. 이벤트 기록에 셀 종료 이유가 포함되어 있습니다.',
  causeAuthRejected: '데스크톱이 인증 중에 이 기기를 거부했습니다.',
  nextAuthRejected:
    '기기가 여전히 페어링되어 있는지 확인하세요. 거부가 반복되면 다시 페어링하세요.',
  causeTailscaleTimeout: '저장된 Tailscale 엔드포인트가 연결 시간 초과 전에 응답하지 않았습니다.',
  causeDirectTimeout: '저장된 직접 연결 엔드포인트가 연결 시간 초과 전에 응답하지 않았습니다.',
  nextRelayRecoveryInProgress:
    'Relay 복구가 진행 중입니다. 다시 시도하는 동안 Dolphin을 열어 두세요.',
  nextCheckNetwork: '로컬/VPN 네트워크를 확인하고 데스크톱이 깨어 있는지 확인하세요.',
  causeHandshakeTimeout: '엔드포인트는 열렸지만 암호화된 Dolphin 핸드셰이크가 완료되지 않았습니다.',
  nextHandshakeTimeout:
    '데스크톱에서 호환되는 Dolphin 버전이 실행 중인지 확인하고 다시 시도하세요.',
  causeRelayRecoveryPending:
    'Relay 복구가 선택되었지만 아직 더 구체적인 실패가 기록되지 않았습니다.',
  nextRelayRecoveryPending: '다음 복구 이벤트가 기록될 때까지 이 페이지를 열어 두세요.',
  causeUnknown: '기록된 이벤트로는 하나의 실패 원인을 특정할 수 없습니다.',
  nextUnknown: '진단을 실행하고 다음 연결 시도 후 보고서를 다시 복사하세요.',
  causeRelayHostOffline:
    'Relay는 응답했지만 데스크톱이 연결되어 있지 않습니다(종료 코드 {code}, 호스트 오프라인).',
  nextRelayHostOffline:
    '데스크톱이 깨어 있고, Dolphin이 실행 중이며, Dolphin Cloud에 로그인되어 있는지 확인하세요.',
  causeRelayCredentialRefused:
    'Relay가 이 기기의 relay 자격 증명을 거부했습니다(종료 코드 {code}).',
  nextRelayCredentialRefused: '이 휴대폰을 데스크톱과 다시 페어링하세요.',
  causeRelayUnreachable: '휴대폰이 Relay 셀에 연결할 수 없었습니다(전송 종료 {code}).',
  nextRelayUnreachable:
    '이 휴대폰의 네트워크 연결을 확인하세요. Relay 복구는 자동으로 다시 시도됩니다.',
  causeRelayConnecting:
    'Relay가 코드 {code}(으)로 연결을 닫았습니다. 복구가 다시 확인하고 재시도합니다.',
  nextRelayConnecting: 'Relay 복구가 다시 시도하는 동안 Dolphin을 열어 두세요.',
  causeRelayDialNoAnswer: '셀이 응답하기 전에 Relay 연결이 실패했습니다.',
  // Developer and OTA rows
  hybridShellDevelopmentBuild: '하이브리드 셸(개발 빌드)',
  hybridShellOtaBuild: '하이브리드 셸(OTA 빌드)',
  openHybridShell: '첫 번째 페어링된 호스트의 하이브리드 셸 열기',
  workspaceUpdates: '워크스페이스 업데이트',
  // Workspace update failures
  updateFailedAgo: '{host}의 마지막 업데이트가 {ago} 전에 실패했습니다: {reason}.',
  updateFailedJustNow: '{host}의 마지막 업데이트가 방금 실패했습니다: {reason}.',
  reasonWithGeneration: '{reason}(세대 {generation})',
  outcomeOpenedCached: '저장된 버전으로 대체했습니다.',
  outcomeOpenedCachedGeneration: '저장된 버전으로 대체했습니다(세대 {generation}).',
  outcomeWall: '워크스페이스를 차단했습니다.',
  outcomeWallReason: '차단됨: {reason}.',
  outcomeNativeRoute: '네이티브 화면을 표시했습니다.',
  outcomeFailed: '실패 화면을 표시했습니다.',
  outcomeWaiting: '호스트를 기다렸습니다.',
  reasonNoConnection: '호스트에 연결되지 않음',
  reasonConnectionLost: '연결이 끊김',
  reasonHostRefused: '호스트가 읽기를 거부함',
  reasonReplyUnreadable: '호스트가 이 앱이 읽을 수 없는 응답을 보냄',
  reasonChunkOversize: '청크가 호스트 허용 크기보다 큼',
  reasonAssetOverlong: '에셋이 매니페스트에 선언된 것보다 김',
  reasonAssetNoProgress: '에셋 읽기가 진행되지 않음',
  reasonAssetShort: '에셋이 선언된 크기보다 일찍 끝남',
  reasonAssetChecksumMismatch: '에셋 체크섬 불일치',
  reasonBuildChangedMidFetch: '다운로드 중 호스트 빌드가 변경됨',
  reasonChunkMisrouted: '청크가 잘못된 에셋 또는 오프셋에 응답함',
  reasonAssetEntryChanged: '에셋이 더 이상 매니페스트와 일치하지 않음',
  reasonRangeUndecodable: '압축된 읽기를 디코딩할 수 없음',
  reasonFetchStopped: '다운로드가 중지됨',
  reasonCacheWriteFailed: '이 휴대폰에 다운로드를 저장하지 못함',
  reasonUnrecognisedError: '알 수 없는 오류',
  hostCodeUnavailable: '호스트에 워크스페이스 번들이 없음',
  hostCodeBuildChanged: '다운로드 중 호스트 빌드가 변경됨',
  hostCodeAssetUnknown: '호스트가 에셋을 인식하지 못함',
  hostCodeAssetChanged: '호스트에서 에셋이 변경됨',
  hostCodeOffsetInvalid: '호스트가 읽기 오프셋을 거부함',
  hostCodeReadLimited: '호스트가 동시 읽기를 제한함',
  wallBundleUnavailable: '호스트에 워크스페이스 번들이 없음',
  wallBundleShellTooOld: '이 앱이 저장된 번들에 비해 너무 오래됨',
  wallHostTooOldForBundle: '호스트가 저장된 번들에 비해 너무 오래됨',
  wallBundleTooOldForHost: '저장된 번들이 호스트에 비해 너무 오래됨'
}
