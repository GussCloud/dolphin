import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspaceKo: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: '로컬 훅',
  setupSourceRepository: '리포지토리 훅',

  // Workspace create drawer
  selectRepository: '리포지토리 선택',
  sshConnection: 'SSH 연결',
  remoteRepository: '원격 리포지토리',
  connecting: '연결 중...',
  workspaceName: '워크스페이스 이름',
  optionalHint: '[선택 사항]',
  agent: '에이전트',
  connectRepositoryFirst: '먼저 리포지토리를 연결하세요',
  detectingAgents: '에이전트를 감지하는 중...',
  advanced: '고급',
  startFrom: '시작 위치',
  defaultBranch: '기본 브랜치',
  createFromRef: '{ref}에서 생성',
  linearWorkspaceNeedsRepository: 'Linear 워크스페이스를 만들기 전에 Git 리포지토리를 추가하세요.',
  repositoryNotFound: '리포지토리를 찾을 수 없습니다.',
  connectRepository: '리포지토리 연결',

  // Workspace option pickers
  startFromTitle: '시작 위치',
  startFromSubtitle: '기존 브랜치 또는 ref를 선택하세요.',
  searchBranches: '브랜치 검색',
  defaultBranchSubtitle: '이 리포지토리에 구성된 기본값 사용',
  noBranchesMatch: '일치하는 브랜치가 없습니다.',
  branchNameLabel: '브랜치 이름: {branch}',
  sparseCheckoutTitle: '스파스 체크아웃',
  fullCheckout: '전체 체크아웃',
  fullCheckoutSubtitle: '전체 리포지토리 사용',
  editPresetLabel: '{name} 편집',
  newPreset: '새 프리셋',

  // Sparse presets and setup trust
  newSparsePreset: '새 스파스 프리셋',
  editSparsePreset: '스파스 프리셋 편집',
  presetName: '이름',
  presetDirectories: '디렉터리',
  directoryCount: { one: '디렉터리 {count}개', other: '디렉터리 {count}개' },
  runSetupScriptTitle: '설정 스크립트를 실행할까요?',
  setupChoiceRequired: '이 워크스페이스를 만들기 전에 {repo}의 설정 방식을 선택해야 합니다.',
  runSetupAndCreate: '설정 실행 후 생성',
  skipSetupAndCreate: '설정 건너뛰고 생성',
  setupScriptChanged: '{repo}의 설정 스크립트가 변경되었습니다',
  runSetupFrom: '{repo}의 설정을 실행할까요?',
  setupTrustWarning:
    '이 리포지토리의 dolphin.yaml은 워크스페이스가 시작되기 전에 사용자 컴퓨터에서 실행됩니다. 이 리포지토리를 신뢰하는 경우에만 실행하세요.',
  newSetupScript: '새 설정 스크립트',
  setupScript: '설정 스크립트',
  trustSetupScriptError: '설정 스크립트를 신뢰하지 못했습니다.',
  runHooks: '훅 실행',
  alwaysTrustAndRun: '항상 신뢰하고 실행',
  dontRun: '실행 안 함',

  // Workspace create operations
  sshConnected: '연결됨',
  sshConnecting: '연결 중',
  sshDeployingRelay: '릴레이 배포 중',
  sshReconnecting: '다시 연결 중',
  sshAuthFailed: '인증 실패',
  sshReconnectFailed: '다시 연결 실패',
  sshConnectionFailed: '연결 실패',
  sshDisconnected: '연결 끊김',
  agentLaunchUnsupportedWarning:
    '워크스페이스가 생성되었지만 이 컴퓨터는 휴대폰에서 에이전트를 시작할 수 없습니다.',
  agentLaunchFailedWarning: '워크스페이스가 생성되었지만 에이전트가 시작되지 않았습니다: {reason}',
  searchFailed: '검색 실패',
  sparseDirectoriesInvalid:
    '루트, 절대 경로 또는 상위 경로가 아닌 리포지토리 기준 상대 디렉터리를 사용하세요.',
  sparseDirectoriesEmpty: '디렉터리를 하나 이상 추가하세요.',
  unknownError: '알 수 없는 오류',
  createWorkspaceError: '워크스페이스를 만들지 못했습니다',

  // Smart workspace source modes
  smartModeSmart: '스마트',
  smartModeBranch: '브랜치',
  smartModeName: '이름',

  // Action errors
  resolveBaseBranchError: '기본 브랜치를 확인하지 못했습니다.',
  agentDisabled:
    '선택한 에이전트가 비활성화되어 있습니다. 생성하기 전에 활성화된 에이전트를 선택하세요.',
  nameRequired: '이름은 필수입니다.',
  openShellSubtitle: '셸 열기',
  sparsePresetsLoadError: '스파스 프리셋을 로드하지 못했습니다.',
  branchSearchError: '브랜치를 검색하지 못했습니다.',
  sparsePresetSaveError: '스파스 프리셋을 저장하지 못했습니다.',
  sshStateReadError: 'SSH 연결 상태를 읽지 못했습니다.',
  sshConnectError: 'SSH 리포지토리에 연결하지 못했습니다.',
  connectRepoBeforeWorkspace: '워크스페이스를 만들기 전에 {repo}을(를) 연결하세요.',
  nameTooLong: '이름은 80자 이하여야 합니다.',
  nameAlreadyExists: '"{name}"이(가) 이미 있습니다.',
  blankTerminal: '빈 터미널'
}
