import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewPtBR: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: 'Alterações commitadas indisponíveis',
  committedChangesFailed: 'Falha ao carregar as alterações commitadas',
  updateDesktopToReview: 'Atualize o Dolphin no desktop para revisar alterações no celular.',
  loadChangesFailed: 'Não foi possível carregar as alterações',
  sourceControlResponseInvalid: 'A resposta do controle de código-fonte é inválida',
  loadReviewNotesFailed: 'Não foi possível carregar as notas de revisão',
  loadDiffFailed: 'Não foi possível carregar o diff',
  committedDiffUnavailable: 'O diff commitado está indisponível',

  scopeBranch: 'Branch',
  scopeStaged: 'Preparado',
  scopeUnstaged: 'Não preparado',
  committedOnBranch: 'Commitado na branch',

  waitingForDesktop: 'Aguardando o desktop...',
  sourceControlActionFailed: 'Falha na ação de controle de código-fonte',
  stagedWithFailures: '{staged} preparados, {failed} com falha',
  reviewedFilesStaged: {
    one: '{count} arquivo revisado preparado',
    other: '{count} arquivos revisados preparados'
  },
  saveReviewStateFailed: 'Falha ao salvar o estado da revisão',
  saveReviewFailed: 'Falha ao salvar a revisão',
  missingWorktree: 'Worktree ausente',
  loadReviewFailed: 'Não foi possível carregar a revisão',
  openInSessionFailed: 'Não foi possível abrir na sessão',
  copyReviewNotesFailed: 'Não foi possível copiar as notas de revisão',
  reviewNotesCopied: 'Notas de revisão copiadas',
  sendNotesFailed: 'Falha ao enviar as notas',
  terminalInputLocked: 'A entrada do terminal está bloqueada',
  reviewNotesSent: 'Notas de revisão enviadas',
  createTerminalFailed: 'Falha ao criar o terminal',
  loadAgentSessionsFailed: 'Não foi possível carregar as sessões de agentes',

  requestFailed: 'Falha na solicitação: {method}',
  refreshPullRequestFailed: 'Falha ao atualizar o pull request.',
  mergePullRequestFailed: 'Falha ao fazer merge do pull request.',
  notConnected: 'Não conectado',
  notConnectedToDesktop: 'Não conectado ao desktop.',
  waitingForDesktopEllipsis: 'Aguardando o desktop…',
  launchAgentFailed: 'Falha ao iniciar o agente',
  commentActionFailed: 'Falha na ação do comentário',
  updateTitleFailed: 'Falha ao atualizar o título.',
  updateReviewThreadFailed: 'Falha ao atualizar a conversa da revisão.',
  loadPullRequestFailed: 'Não foi possível carregar o pull request',
  sendPromptFailed: 'Falha ao enviar o prompt',

  sendResumeCommandFailed: 'Falha ao enviar o comando de retomada',
  prepareLegacyCodexFailed:
    'Não foi possível preparar esta sessão legada do Codex. Tente retomar novamente.'
}
