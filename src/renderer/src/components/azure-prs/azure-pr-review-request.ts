import { translate } from '@/i18n/i18n'
import type { AzureDevOpsBoardPullRequest } from '../../../../shared/azure-devops-pull-request-board'

// Plain text on purpose: Teams does not render markdown on paste, and a bare URL on its own line is linkified.
export function buildAzureReviewRequest(pullRequests: AzureDevOpsBoardPullRequest[]): string {
  if (pullRequests.length === 0) {
    return ''
  }

  const head =
    pullRequests.length === 1
      ? translate(
          'auto.components.azurePrs.reviewRequest.headOne',
          'Hi! Could you review this PR, please?'
        )
      : translate(
          'auto.components.azurePrs.reviewRequest.headMany',
          'Hi! Could you review these {{value0}} PRs, please?',
          { value0: pullRequests.length }
        )

  const items = pullRequests.map((pr) => {
    const workItems = pr.workItemIds.length
      ? ` (${pr.workItemIds.map((id) => `#${id}`).join(', ')})`
      : ''
    return [
      `- !${pr.id} - ${pr.title}${workItems}`,
      `  ${pr.repository} -> ${pr.targetBranch}`,
      `  ${pr.url}`
    ].join('\n')
  })

  const thanks = translate('auto.components.azurePrs.reviewRequest.thanks', 'Thanks!')
  return `${head}\n\n${items.join('\n\n')}\n\n${thanks}`
}
