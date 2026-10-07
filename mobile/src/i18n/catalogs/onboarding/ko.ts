import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingKo: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: '세션을 어떻게 열까요?',
  sessionViewBody:
    '지원되는 에이전트 세션을 이 기기에서 터미널로 열지 Chat UI로 열지 선택하세요. 세션 탭을 길게 눌러 보기를 전환하거나, 나중에 설정에서 기본값을 바꿀 수 있습니다.',
  useChatUi: 'Chat UI 사용',
  useChatUiA11y: 'Chat UI에서 세션 열기',
  keepTerminal: '터미널 유지',
  keepTerminalA11y: '터미널에서 세션 열기',
  // Notifications step
  notificationsTitle: '에이전트가 나를 필요로 할 때 놓치지 마세요',
  notificationsBody:
    '에이전트가 작업을 마치거나 대기 중일 때 앱을 사용하지 않아도 이 휴대폰으로 알림을 받습니다.',
  notificationsDisclosure:
    '데스크톱이 3분 동안 유휴 상태이면 Dolphin 푸시 서비스를 통해 전달됩니다. 언제든지 설정에서 변경할 수 있습니다.',
  enableNotifications: '알림 켜기',
  enableNotificationsA11y: '에이전트 알림 켜기',
  notNow: '나중에',
  notNowA11y: '지금은 알림 건너뛰기',
  // Sample notification banners
  sampleNow: '지금',
  sampleCodexTitle: 'Codex 완료',
  sampleCodexBody: '테스트가 통과했습니다.',
  sampleClaudeTitle: 'Claude가 입력을 기다립니다',
  sampleClaudeBody: '기다리는 중입니다.'
}
