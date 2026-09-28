import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
}

test('Terraform exposes the audited production environment values', async () => {
  const outputs = await source('infra/terraform/outputs.tf')
  for (const output of [
    'github_relay_monitor_workload_identity_provider',
    'github_relay_monitor_service_account',
    'github_relay_fence_workload_identity_provider',
    'github_relay_fence_service_account'
  ]) {
    assert.match(outputs, new RegExp(`output "${output}"`))
  }
})

test('fence broker pins the production-proven Terraform planner', async () => {
  const dockerfile = await source('apps/relay-fence-broker/Dockerfile')
  assert.match(dockerfile, /FROM hashicorp\/terraform:1\.15\.8 AS terraform/)
})

