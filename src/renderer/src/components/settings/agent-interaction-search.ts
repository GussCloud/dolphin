import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translateSearchKeyword } from './settings-search-keywords'

export const getAgentInteractionPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('agentInteraction.settings.enable.title', 'Enable Agent Integration'),
    description: translate(
      'agentInteraction.search.enable',
      'Floating avatar and sound when an agent needs you or finishes.'
    ),
    keywords: [
      ...translateSearchKeyword('agentInteraction.search.keyword.avatar', 'avatar'),
      ...translateSearchKeyword('agentInteraction.search.keyword.floating', 'floating'),
      ...translateSearchKeyword('agentInteraction.search.keyword.alert', 'alert'),
      ...translateSearchKeyword('agentInteraction.search.keyword.permission', 'permission')
    ]
  },
  {
    title: translate('agentInteraction.settings.avatar.title', 'Avatar'),
    description: translate('agentInteraction.search.avatar', 'Picture shown on the floating card.'),
    keywords: [
      ...translateSearchKeyword('agentInteraction.search.keyword.image', 'image'),
      ...translateSearchKeyword('agentInteraction.search.keyword.picture', 'picture')
    ]
  },
  {
    title: translate('agentInteraction.search.sounds', 'Event sounds'),
    description: translate(
      'agentInteraction.search.soundsDescription',
      'A different sound for each agent status, or your own audio file.'
    ),
    keywords: [
      ...translateSearchKeyword('agentInteraction.search.keyword.sound', 'sound'),
      ...translateSearchKeyword('agentInteraction.search.keyword.audio', 'audio'),
      ...translateSearchKeyword('agentInteraction.search.keyword.volume', 'volume')
    ]
  }
])
