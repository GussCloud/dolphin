import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homeKo: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: '다시 시도해 주세요.',
  remove: '제거',
  update: '업데이트',
  tasks: '작업',
  openSettings: '설정 열기',
  // Host actions
  checkPairingErrorTitle: '페어링을 확인할 수 없습니다',
  removeHostErrorTitle: '호스트를 제거할 수 없습니다',
  removeHostTitle: '호스트 제거',
  removeHostMessage: '"{name}"을(를) 제거할까요? 나중에 다시 페어링할 수 있습니다.',
  updateDesktopTitle: '데스크톱 업데이트',
  // Empty state
  emptyTitle: '데스크톱 연결',
  emptyBody:
    '컴퓨터의 Dolphin과 페어링하면 에이전트를 확인하고, 어떤 터미널로든 바로 들어가고, 휴대폰에서 작업을 진행할 수 있습니다.',
  pairDesktop: '데스크톱 페어링',
  howItWorks: '사용 방법',
  stepOpenDesktopTitle: 'Dolphin 데스크톱 열기',
  stepOpenDesktopDesc: '설정 → 모바일로 이동해 페어링 QR 코드를 생성하세요.',
  stepScanTitle: '코드 스캔',
  stepScanDesc: '위 버튼을 눌러 스캐너를 열고 화면의 QR 코드를 비추세요.',
  stepConnectedTitle: '연결 완료',
  stepConnectedDesc: '데스크톱이 여기에 표시됩니다. 모든 내용은 종단 간 암호화됩니다.',
  // List header and footer
  welcomeBack: '다시 오신 것을 환영합니다',
  statAgentsSpawned: '실행한 에이전트',
  statAgentTime: '에이전트 시간',
  statPRsCreated: '생성한 PR',
  durationDaysHours: '{days}일 {hours}시간',
  durationHoursMinutes: '{hours}시간 {minutes}분',
  durationMinutes: '{minutes}분',
  desktops: '데스크톱',
  resume: '이어서 하기',
  accountUsage: '계정 사용량',
  systemDefaultAccount: '시스템 기본값',
  noTaskSources: '연결된 작업 소스 없음',
  openProviderTasks: '{provider} 작업 열기'
}
