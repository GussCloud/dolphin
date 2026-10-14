import { translate } from '@/i18n/i18n'
import type { AzureDevOpsPullRequestSignal } from '../../../../shared/azure-devops-pull-request-board'
import { isAzurePullRequestSituation } from './azure-pr-tones'

// Why: translate() cannot run at module top level, so every label is resolved per call.
export function situationLabel(situation: string): {
  long: string
  short: string
} {
  switch (isAzurePullRequestSituation(situation) ? situation : 'pending') {
    case 'conflicts':
      return {
        long: translate(
          'auto.components.azurePrs.situation.conflicts',
          'Conflicts with the target'
        ),
        short: translate('auto.components.azurePrs.situation.conflictsShort', 'Conflict')
      }
    case 'rejected':
      return {
        long: translate('auto.components.azurePrs.situation.rejected', 'Rejected by a reviewer'),
        short: translate('auto.components.azurePrs.situation.rejectedShort', 'Rejected')
      }
    case 'build_failed':
      return {
        long: translate('auto.components.azurePrs.situation.buildFailed', 'Policy failed'),
        short: translate('auto.components.azurePrs.situation.buildFailedShort', 'Policy')
      }
    case 'waiting_author':
      return {
        long: translate('auto.components.azurePrs.situation.waitingAuthor', 'Ball in my court'),
        short: translate('auto.components.azurePrs.situation.waitingAuthorShort', 'Mine')
      }
    case 'approved':
      return {
        long: translate('auto.components.azurePrs.situation.approved', 'Approved'),
        short: translate('auto.components.azurePrs.situation.approved', 'Approved')
      }
    case 'draft':
      return {
        long: translate('auto.components.azurePrs.situation.draft', 'Draft'),
        short: translate('auto.components.azurePrs.situation.draftShort', 'Draft')
      }
    case 'pending':
      return {
        long: translate(
          'auto.components.azurePrs.situation.pending',
          'Pending — not released for merge yet'
        ),
        short: translate('auto.components.azurePrs.situation.pendingShort', 'Pending')
      }
  }
}

export function voteLabel(vote: number): string {
  if (vote === 10) {
    return translate('auto.components.azurePrs.vote.approved', 'Approved')
  }
  if (vote === 5) {
    return translate(
      'auto.components.azurePrs.vote.approvedWithSuggestions',
      'Approved with suggestions'
    )
  }
  if (vote === -5) {
    return translate('auto.components.azurePrs.vote.waitingAuthor', 'Waiting for the author')
  }
  if (vote === -10) {
    return translate('auto.components.azurePrs.vote.rejected', 'Rejected')
  }
  return translate('auto.components.azurePrs.vote.none', 'No vote')
}

export function policyLabel(status: string): string {
  switch (status) {
    case 'approved':
      return translate('auto.components.azurePrs.policy.approved', 'ok')
    case 'rejected':
      return translate('auto.components.azurePrs.policy.rejected', 'failed')
    case 'broken':
      return translate('auto.components.azurePrs.policy.broken', 'broken')
    case 'running':
      return translate('auto.components.azurePrs.policy.running', 'running')
    case 'queued':
      return translate('auto.components.azurePrs.policy.queued', 'queued')
    case 'notApplicable':
      return translate('auto.components.azurePrs.policy.notApplicable', 'n/a')
    default:
      return status
  }
}

export function ageLabel(days: number): string {
  if (days <= 0) {
    return translate('auto.components.azurePrs.age.today', 'today')
  }
  if (days === 1) {
    return translate('auto.components.azurePrs.age.oneDay', '1 day')
  }
  return translate('auto.components.azurePrs.age.days', '{{value0}} days', {
    value0: days
  })
}

export function signalText(signal: AzureDevOpsPullRequestSignal): string {
  switch (signal.kind) {
    case 'conflicts':
      return translate(
        'auto.components.azurePrs.signal.conflicts',
        'Conflicts with the target branch'
      )
    case 'rejected':
      return translate(
        'auto.components.azurePrs.signal.rejected',
        '{{value0}} reviewer rejection(s)',
        { value0: signal.count }
      )
    case 'waiting-author':
      return translate(
        'auto.components.azurePrs.signal.waitingAuthor',
        '{{value0}} reviewer(s) waiting for the author',
        { value0: signal.count }
      )
    case 'policy-failed':
      return translate(
        'auto.components.azurePrs.signal.policyFailed',
        'Policy failed: {{value0}}',
        { value0: signal.names.join(', ') }
      )
    case 'unresolved-threads':
      return translate(
        'auto.components.azurePrs.signal.unresolvedThreads',
        '{{value0}} unresolved comment(s)',
        { value0: signal.count }
      )
    case 'validation-running':
      return translate(
        'auto.components.azurePrs.signal.validationRunning',
        'Validation still running'
      )
    case 'approvals':
      return translate('auto.components.azurePrs.signal.approvals', '{{value0}} approval(s)', {
        value0: signal.count
      })
    case 'person-approvals-missing-group':
      return translate(
        'auto.components.azurePrs.signal.personApprovalsMissingGroup',
        '{{value0}} approval(s) from people — the reviewer group is still missing',
        { value0: signal.count }
      )
    case 'nothing-pending':
      return translate(
        'auto.components.azurePrs.signal.nothingPending',
        'Nothing pending — waiting for review'
      )
  }
}

// `Product Backlog Item` is too long for a group header.
export function workItemTypeLabel(type: string): string {
  switch (type) {
    case 'Product Backlog Item':
      return 'PBI'
    case 'User Story':
      return 'Story'
    default:
      return type
  }
}
