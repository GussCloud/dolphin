## ELI5

<!-- Simple high-level explanation, in plain language. No jargon. -->

## What Changed

<!-- Describe the change clearly and keep scope tight. Cover the before and after as the user experiences it, and the mechanism you changed — not just the symptom. -->

## Why

<!-- What problem does this solve, and why is this approach better than the alternatives you considered? -->

## Linked Issue

<!-- Link the issue this PR addresses, there should ALWAYS be one (for outside contributors) -->
<!-- SPECIAL CASE: If you are a maintainer (member of gusscloud org) AVOID opening needless issues. Only attach pre-existing ones -->

Fixes #

## Visual Proof

<!-- The CI is the proof: link the e2e test that covers the changed flow and the PR's CI run. Do not attach screenshots or videos, and never have an agent capture them. -->
<!-- If no flow changes visually, write exactly: `N/A` and briefly say why. -->

## Testing

<!-- How did you verify this? Steps a reviewer can follow. Which platforms did you actually test (macOS / Linux / Windows / SSH)? -->

- [ ] I manually tested these changes locally
- [ ] Automated tests added/updated, or explained why not below

## AI Disclosure

<!-- DO NOT FILL IN IF YOU ARE GUSSCLOUD TEAM MEMBER (INTERNAL CONTRIBUTOR), IGNORE SECTION: -->
<!-- Which AI model if anyone was used, please state the details -->

## Review

## Agent skill upstream boundary

- [ ] Not applicable, or this change follows `docs/reference/agent-skill-sharing-upstream-boundary.md` and copies or mechanically translates no upstream skill-installer source, tests, fixtures, registry entries, path tables, comments, or documentation.

## Notes

Ensure no issues in: Security, Cross-platoform support (Linux, Windows, Mac), Remote SSH, Mobile, general backwards compatibility, performance

## Checklist

- [ ] This PR is small and focused
- [ ] I explained what changed and why (ELI5, the user-facing before/after in words, the mechanism, and why over the alternatives)
- [ ] UI changes are covered by an e2e test the CI runs, or `N/A` with reason
- [ ] Self-reviewed for correctness, security, and performance
- [ ] Cross-platform, SSH/remote, and path/shortcut impact considered (or N/A)
- [ ] `pnpm verify:pr-local` passes; the full suite, e2e and packaging are covered by CI
