import type { PRCommentAudienceFilter } from '../../../../src/shared/pr-comment-audience'
import { componentsPrSidebarCatalog } from '../../i18n/catalogs/components-pr-sidebar'
import { translate } from '../../i18n/mobile-locale-state'

export const PR_COMMENT_AUDIENCE_FILTERS = [
  { value: 'all', labelKey: 'audienceAll' },
  { value: 'human', labelKey: 'audienceHumans' },
  { value: 'bot', labelKey: 'audienceBots' }
] as const satisfies readonly { value: PRCommentAudienceFilter; labelKey: string }[]

export function getPRCommentAudienceEmptyLabel(filter: PRCommentAudienceFilter): string {
  switch (filter) {
    case 'bot':
      return translate(componentsPrSidebarCatalog, 'noBotComments')
    case 'human':
      return translate(componentsPrSidebarCatalog, 'noHumanComments')
    case 'all':
      return translate(componentsPrSidebarCatalog, 'noCommentsYet')
  }
}
