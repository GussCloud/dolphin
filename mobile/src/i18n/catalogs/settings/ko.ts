import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { settingsEn } from './en'

export const settingsKo: MobileLocaleMessages<typeof settingsEn> = {
  back: '뒤로',
  on: '켜짐',
  off: '꺼짐',
  retry: '다시 시도',
  openSettings: '설정 열기',

  settings: '설정',
  terminal: '터미널',
  chatUi: 'Chat UI',
  browser: '브라우저',
  voice: '음성',
  notifications: '알림',
  backgroundConnection: '백그라운드 연결',
  language: '언어',
  troubleshooting: '문제 해결',
  about: '정보',
  privacyPolicy: '개인정보 처리방침',
  support: '지원',

  languageHeading: '앱 언어',
  languageDescription: '이 기기에서 Dolphin 앱에 사용할 언어를 선택합니다.',
  languageSystemDefault: '시스템 기본값',
  languageSaveError: '언어를 저장하지 못했습니다. 다시 시도하세요.',

  aboutTagline: '100x 빌더를 위한 오픈 소스 에이전트 IDE',
  aboutWebsite: 'Dolphin 웹사이트',
  aboutSourceCode: 'Dolphin 소스 코드',
  aboutOnX: 'X의 Dolphin',
  aboutOpenLinkError: '링크를 열지 못했습니다. 다시 시도하세요.',

  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    '앱을 떠난 후에도 Relay 연결을 열어 두어 바로 다시 열리도록 합니다. 켜져 있는 동안 Android에 상시 알림이 표시되고 배터리 사용량이 늘어납니다.',
  backgroundStayConnected: '백그라운드에서 연결 유지',
  backgroundRetentionOffSubtitle: '앱을 떠나면 곧 연결을 끊습니다.',
  backgroundRetention15m: '15분',
  backgroundRetention15mSubtitle: '백그라운드에서 15분 동안 연결을 유지합니다.',
  backgroundRetention1h: '1시간',
  backgroundRetention1hSubtitle: '백그라운드에서 1시간 동안 연결을 유지합니다.',
  backgroundRetentionAlways: '항상',
  backgroundRetentionAlwaysSubtitle: '이 옵션을 끌 때까지 연결을 유지합니다.',
  backgroundSaveError: '백그라운드 연결 설정을 저장하지 못했습니다. 다시 시도하세요.',
  backgroundSystemHeading: '시스템',
  backgroundSystemDescription:
    '배터리 절약 기능이 연결을 끊을 수 있습니다. Dolphin이 제한 없이 실행되도록 허용하세요.',
  backgroundSystemDescriptionWithAutostart:
    '배터리 절약 기능이 연결을 끊을 수 있습니다. Dolphin이 제한 없이 실행되도록 허용하고 자동 시작을 켜세요.',
  backgroundBatteryOptimization: '배터리 최적화',
  backgroundUnrestricted: '제한 없음',
  backgroundRestricted: '제한됨 — 탭하여 허용',
  backgroundAutostart: '자동 시작',
  backgroundAutostartHint: 'Xiaomi, Redmi, POCO 기기에서 필요',

  browserLinksHeading: '링크',
  browserLinksDescription: '터미널 출력에서 탭한 HTTP(S) 링크를 열 위치를 선택합니다.',
  browserOpenTerminalLinks: '터미널 링크 열기',
  browserModeDolphin: '데스크톱의 Dolphin 브라우저',
  browserModeDolphinSubtitle: '페어링된 데스크톱에서 스트리밍되는 브라우저에서 엽니다.',
  browserModePhone: '휴대폰 브라우저',
  browserModePhoneSubtitle: '이 휴대폰의 Safari, Chrome 또는 다른 브라우저에서 엽니다.',
  browserLoadError: '브라우저 환경설정을 불러오지 못했습니다. 다시 시도하세요.',
  browserSaveError: '브라우저 환경설정을 저장하지 못했습니다. 다시 시도하세요.',

  chatDefaultViewHeading: '기본 보기',
  chatDefaultViewDescription:
    '지원되는 에이전트 세션(Claude, Codex 및 기타 채팅 지원 에이전트)을 이 기기에서 여는 방식을 선택합니다. 터미널은 원시 CLI를 표시하고, Chat UI는 데스크톱 앱과 같은 채팅 화면을 표시합니다. 개별 세션은 길게 누르기 메뉴에서 언제든 전환할 수 있습니다.',
  chatOpenSessionsInChatUi: 'Chat UI에서 세션 열기',

  notificationsEnable: '알림 사용',
  notificationsDefaultDescription:
    '에이전트에 입력이 필요하거나 작업을 완료하면 이 기기로 알려 드립니다.',
  notificationsPushDescription:
    '앱이 닫혀 있어도 에이전트 알림을 받습니다. Dolphin 푸시 서비스와 Apple 또는 Google을 통해 전달됩니다.',
  notificationsBlocked: '시스템 설정에서 알림이 꺼져 있습니다.',
  notificationsLoadError: '알림 설정을 불러오지 못했습니다. 다시 시도하세요.',
  notificationsSaveError: '알림 설정을 저장하지 못했습니다. 다시 시도하세요.',
  notificationsOpenSettingsError: '시스템 설정을 열지 못했습니다. 다시 시도하세요.',
  deliveryLoadError: '전달 설정을 불러오지 못했습니다. 이 화면을 다시 열어 재시도하세요.',
  deliverySaveError: '전달 설정을 저장하지 못했습니다. 다시 시도하세요.',
  deliveryNeedsUpdatedDesktop: '이 휴대폰에서 알림을 받으려면 최신 데스크톱과 페어링하세요.',

  pushTestHeading: '알림을 받는 데 문제가 있나요?',
  pushTestDetail: 'Dolphin 푸시 서비스로 테스트 알림을 보냅니다.',
  pushTestSend: '테스트 알림 보내기',
  pushTestSending: '전송 중…',
  pushTestLoadHostsError: '페어링된 데스크톱을 불러오지 못했습니다.',
  pushTestPairDesktop: '데스크톱을 페어링한 후 다시 시도하세요.',
  pushTestConnectDesktop: '데스크톱에 연결한 후 다시 시도하세요.',
  pushTestUpdateDesktop: '이 테스트를 실행하려면 데스크톱을 업데이트하세요.',
  pushTestReachError: '데스크톱에 연결하지 못했습니다. 다시 시도하세요.',
  pushTestAccepted: 'Dolphin 푸시 서비스가 접수했습니다. 알림이 도착했는지 확인하세요.',
  pushTestNotRegistered: '다시 연결하여 이 휴대폰을 알림용으로 등록하세요.',
  pushTestRateLimited: '알림이 너무 많습니다. 나중에 다시 시도하세요.',
  pushTestSendError: 'Dolphin 푸시 서비스로 보내지 못했습니다. 다시 시도하세요.',
  pushTestGenericError: '푸시 테스트를 보내지 못했습니다.',

  credentialCleanupTitle: '페어링 자격 증명 정리',
  credentialCleanupRetryFailed: '아직 정리를 확인할 수 없습니다. 나중에 다시 시도하세요.',
  credentialCleanupPending: {
    one: '이 기기에서 자격 증명 {count}개의 정리를 확인하지 못했습니다.',
    other: '이 기기에서 자격 증명 {count}개의 정리를 확인하지 못했습니다.'
  },
  credentialCleanupUnreadable:
    '이 기기에서 정리 상태를 확인하지 못했습니다. 안전을 위해 다시 시도하세요.',
  credentialCleanupRetryLabel: '페어링 자격 증명 정리 다시 시도',

  voiceConnectDesktop: '음성 설정을 관리하려면 데스크톱에 연결하세요.',
  voiceLoadError: '음성 설정을 불러오지 못했습니다.',
  voiceUpdateError: '업데이트하지 못했습니다.',
  voiceSelectModelError: '모델을 선택하지 못했습니다.',
  voiceDownloadError: '다운로드에 실패했습니다.',
  voiceDeleteError: '삭제에 실패했습니다.',
  voiceDictationHeading: '받아쓰기',
  voiceEnableDictation: '음성 받아쓰기 활성화',
  voiceEnableDictationDescription: '데스크톱에서 포커스된 창에 텍스트를 받아씁니다.',
  voiceDictationMode: '받아쓰기 모드',
  voiceDictationModeDescription:
    '토글: 한 번 눌러 시작하고 다시 눌러 멈춥니다. 길게 누르기: 누르고 있는 동안 받아씁니다.',
  voiceModeToggle: '토글',
  voiceModeHold: '길게 누르기',
  voiceSpeechModelHeading: '음성 모델',
  voiceSpeechModel: '음성 모델',
  voiceNoModelSelected: '선택 안 됨',

  terminalLeaveHeading: '앱을 떠날 때',
  terminalLeaveDescription:
    '휴대폰에서 터미널을 사용하는 동안 Dolphin은 화면에 맞게 터미널을 축소합니다. 앱을 닫거나 다른 앱으로 전환할 때 휴대폰 크기를 유지할지(대화형 CLI 도구가 다시 배치되지 않도록), 데스크톱 크기로 되돌릴지를 이 설정으로 정합니다. 배너의 이 터미널 복원 또는 모든 터미널 복원을 사용해 언제든 직접 크기를 조정할 수 있습니다.',
  terminalNoHosts:
    '아직 페어링된 데스크톱이 없습니다. 터미널 동작을 제어하려면 하나를 페어링하세요.',
  terminalRestoreKeepPhoneSize: '휴대폰 크기 유지(기본값)',
  terminalRestoreAfter1Minute: '1분 후',
  terminalRestoreAfter5Minutes: '5분 후',
  terminalRestoreAfter30Minutes: '30분 후',
  terminalRestoreAfterSeconds: '{seconds}초 후',
  terminalRestorePickerTitle: '{host} 복원',
  terminalTextSizeHeading: '텍스트 크기',
  terminalTextSizeDescription:
    '터미널 텍스트 크기를 조정합니다. 작은 크기는 좌우 여백과 함께 더 많은 열을 표시하고, 큰 크기는 더 적은 열을 표시합니다 — 옆으로 드래그해 이동하세요. 터미널에서 직접 핀치해 확대·축소할 수도 있으며, 이 설정이 함께 업데이트됩니다. 이 기기의 표시에만 적용되며 데스크톱 터미널은 바뀌지 않습니다.',
  terminalTextSize: '텍스트 크기',
  terminalTextSizePickerTitle: '터미널 텍스트 크기',
  terminalTextSizeSmallest: '가장 작게 (50%)',
  terminalTextSizeSmaller: '작게 (75%)',
  terminalTextSizeDefault: '기본 (100%)',
  terminalTextSizeLarge: '크게 (125%)',
  terminalTextSizeLarger: '더 크게 (150%)',
  terminalTextSizeLargest: '가장 크게 (200%)',
  terminalKeyboardHeading: '키보드 입력',
  terminalKeyboardDescription:
    '터미널 명령 표시줄에서 휴대폰 방식의 자동 완성, 자동 수정, 맞춤법 제안을 사용합니다. 키보드가 명령, 플래그, 경로를 바꾸지 않도록 기본값은 꺼짐입니다. 직접 키보드 입력(키가 바로 터미널로 전달될 때)은 항상 원래 키 입력을 보내므로 제안이 적용되지 않습니다.',
  terminalAutocomplete: '자동 완성 및 자동 수정'
}
