import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isEntrypoint,
  jobIf,
  jobs,
  readWorkflow,
  workflowFiles
} from './cloud-sql-rollout-lock-census.mjs'
import { relayWorkflowFile } from './relay-repository.mjs'

// Why: this repository publishes the relay's operate surface next to the desktop app. Three
// invariants make that safe, and each of them is one careless edit away from being lost.
const OPERATIONS_GATE = "vars.DOLPHIN_CLOUD_OPERATIONS_ENABLED == 'true'"

// Cloud Verify is the only cloud workflow that must run on every pull request.
const UNGATED = relayWorkflowFile('verify.yml')

const relayWorkflows = () => workflowFiles().filter((file) => file !== UNGATED)

// Why: this repository holds none of the GCP credentials these workflows would need. Every one
// authenticates through Workload Identity read from a variable, so any repository secret other
// than the automatic token would be a credential the owner has to store here.
test('no cloud workflow reads a repository secret', () => {
  for (const file of workflowFiles()) {
    for (const [, name] of readWorkflow(file).matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      assert.equal(name, 'GITHUB_TOKEN', `${file} reads secrets.${name}`)
    }
  }
})

// Why: reusable jobs inherit the caller's gate. Gating them again would be dead configuration
// that reads as protection, and every caller is already checked above.
test('reusable workflows carry no gate of their own', () => {
  for (const file of relayWorkflows()) {
    const text = readWorkflow(file)
    if (isEntrypoint(text)) continue
    for (const job of jobs(text)) {
      assert.ok(!jobIf(job.text).includes(OPERATIONS_GATE), `${file}:${job.id} regates a reusable job`)
    }
  }
})
