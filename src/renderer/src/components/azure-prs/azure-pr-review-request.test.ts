import { describe, expect, it } from 'vitest'
import { azureReviewRequestCopyFailedMessage } from './azure-pr-review-request'

describe('azureReviewRequestCopyFailedMessage', () => {
  it('names ⌘C on macOS', () => {
    expect(azureReviewRequestCopyFailedMessage('darwin')).toBe(
      'Could not copy. Select the text and press ⌘C.'
    )
  })

  it.each(['win32', 'linux'] as const)('names Ctrl+C on %s', (platform) => {
    expect(azureReviewRequestCopyFailedMessage(platform)).toBe(
      'Could not copy. Select the text and press Ctrl+C.'
    )
  })
})
