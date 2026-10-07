import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesKo: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: '호스트',
  routeAccounts: '계정',
  routeTasks: '작업',
  routeTerminal: '터미널',
  routeSourceControl: '소스 제어',
  routeAgentHistory: '에이전트 세션 기록',
  routeChanges: '변경 사항',
  routePullRequest: 'PR',
  routeWorkspace: '워크스페이스',

  // Edit host
  editHost: '호스트 편집',
  back: '뒤로',
  save: '저장',
  saveHostA11y: '호스트 저장',
  goBack: '돌아가기',
  missingHost: '호스트가 없습니다.',
  hostRemoved: '이 호스트는 이 휴대폰에서 제거되었습니다.',
  failedToLoadHost: '호스트를 불러오지 못했습니다.',
  failedToSaveHost: '호스트를 저장하지 못했습니다.',
  editHelp:
    '표시 이름이나 연결 주소를 변경합니다. 이름을 비워 두면 데스크톱이 보고하는 이름을 사용합니다. 주소를 바꾸면 이 휴대폰의 연결 대상만 바뀌며 다시 페어링하지 않습니다. 같은 데스크톱에 다른 IP로 접속할 수 있을 때 사용하세요(예: 집 LAN과 Tailscale).',
  name: '이름',
  hostNamePlaceholder: '호스트 이름',
  address: '주소',
  addressHint:
    'IP, host:port 또는 ws:// / wss://를 입력할 수 있습니다. 포트를 생략하면 현재 포트(또는 6768)를 사용합니다.',
  connectsTo: '{endpoint}에 연결',

  // Accounts
  accounts: '계정',
  invalidSnapshot: '호스트에서 받은 계정 정보가 유효하지 않습니다',
  hostNotFound: '호스트를 찾을 수 없음',
  couldNotSwitchAccount: '계정을 전환할 수 없습니다',
  systemDefault: '시스템 기본값',
  useAgentLogin: '에이전트 자체 로그인 사용',
  connectingToHost: '{host}에 연결 중…',
  connectingToHostGeneric: '호스트에 연결 중…',
  loadingAccounts: '계정 불러오는 중…',
  addAccountsHint: '계정 추가나 재인증은 데스크톱의 설정 → 계정에서 하세요.'
}
