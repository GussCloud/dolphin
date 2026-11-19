import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const pluginModule: unknown = require('./ios-pod-deployment-target-floor.js')

function addPodDeploymentTargetFloor(podfile: string): string {
  if (
    typeof pluginModule !== 'function' ||
    !('addPodDeploymentTargetFloor' in pluginModule) ||
    typeof pluginModule.addPodDeploymentTargetFloor !== 'function'
  ) {
    throw new Error('plugin does not export addPodDeploymentTargetFloor')
  }
  const result: unknown = pluginModule.addPodDeploymentTargetFloor(podfile)
  if (typeof result !== 'string') {
    throw new Error('addPodDeploymentTargetFloor did not return a string')
  }
  return result
}

const PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'
target 'Dolphin' do
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`

describe('addPodDeploymentTargetFloor', () => {
  it('raises pod targets to the Podfile platform value before react_native_post_install', () => {
    const podfile = addPodDeploymentTargetFloor(PODFILE)

    expect(podfile).toContain(
      "app_deployment_target = podfile_properties['ios.deploymentTarget'] || '15.1'"
    )
    expect(podfile.indexOf('app_deployment_target =')).toBeGreaterThan(
      podfile.indexOf('post_install do |installer|')
    )
    expect(podfile.indexOf('app_deployment_target =')).toBeLessThan(
      podfile.indexOf('react_native_post_install')
    )
  })

  it('is idempotent across repeated prebuilds', () => {
    const once = addPodDeploymentTargetFloor(PODFILE)

    expect(addPodDeploymentTargetFloor(once)).toBe(once)
  })

  it('fails the prebuild when the Podfile has no post_install hook', () => {
    expect(() => addPodDeploymentTargetFloor("target 'Dolphin' do\nend\n")).toThrow(/post_install/)
  })
})
