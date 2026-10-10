import { describe, expect, it } from 'vitest'
import { getE2ECompletedOnboardingProfile } from '../../e2e/helpers/e2e-completed-onboarding-profile'
import { buildFreshProfile } from './onboarding-profile.mjs'

// The harness runs as plain Node and cannot import the TS catalogs, so it mirrors them.
// A drifted mirror re-arms a modal that blocks every click on the installed app.
describe('harness fresh profile', () => {
  const harness = buildFreshProfile()
  const e2e = getE2ECompletedOnboardingProfile()

  it('marks every feature tip and first-run tour seen, like the e2e completed-user profile', () => {
    const { featureInteractions: _interactions, ...e2eUi } = e2e.ui
    expect(harness.ui).toEqual(e2eUi)
  })

  it('pins the current onboarding flow version', () => {
    expect(harness.onboarding).toEqual(e2e.onboarding)
  })
})
