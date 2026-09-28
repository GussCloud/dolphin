import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { relayWorkflowUrl } from './relay-repository.mjs'

function workflow(name) {
  return readFileSync(
    fileURLToPath(relayWorkflowUrl(name)),
    'utf8'
  )
}

// Why: the same-cap caller defines release_lease itself, and a caller-defined job presents the
// caller as job_workflow_ref, so the pair must admit the caller alongside its reusable job.
test('shared deploy WIF admits the exact same-cap reusable workflow pair and the caller itself', () => {
  const terraform = readFileSync(
    fileURLToPath(new URL('../../infra/terraform/relay-github-actions.tf', import.meta.url)),
    'utf8'
  )
  const providerStart = terraform.indexOf(
    'resource "google_iam_workload_identity_pool_provider" "github"'
  )
  const providerEnd = terraform.indexOf('\nresource "', providerStart + 1)
  const sharedProvider = terraform.slice(providerStart, providerEnd)
  assert.ok(providerStart >= 0 && providerEnd > providerStart)
  assert.match(sharedProvider, /local\.relay_github_workflow_conditions\["github"\]/)
  // The pairing itself now lives in the clause the provider renders, once per accepted repository.
  assert.match(
    terraform,
    /assertion\.workflow_ref == '\$\{prefix\}\$\{local\.github_production_relay_same_cap_workflow_file\}@refs\/heads\/main' && \(assertion\.job_workflow_ref == '\$\{prefix\}\$\{local\.github_production_relay_same_cap_job_workflow_file\}@refs\/heads\/main' \|\| assertion\.job_workflow_ref == '\$\{prefix\}\$\{local\.github_production_relay_same_cap_workflow_file\}@refs\/heads\/main'\)/
  )
})
