import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { worktreeEn } from './en'
import { worktreeEs } from './es'
import { worktreeFr } from './fr'
import { worktreeJa } from './ja'
import { worktreeKo } from './ko'
import { worktreePtBR } from './pt-BR'
import { worktreeZh } from './zh'

/** Workspace list, agent rows and host worktree summaries (`src/worktree/**`). */
export const worktreeCatalog = defineMobileCatalog({
  en: worktreeEn,
  zh: worktreeZh,
  ko: worktreeKo,
  ja: worktreeJa,
  es: worktreeEs,
  fr: worktreeFr,
  'pt-BR': worktreePtBR
})
