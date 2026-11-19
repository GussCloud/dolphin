const { withPodfile } = require('expo/config-plugins')

// Why: Xcode 27 rejects any target below iOS 15.0, and some pods still declare older minimums
// (SDWebImage 9.0, RNSVG 12.4, RNCAsyncStorage 13.4). Raising them to the app's own minimum,
// the same value as the Podfile's `platform :ios` line, ships nothing to devices the app excluded.
const MARKER = '# dolphin: ios-pod-deployment-target-floor'

const FLOOR_SNIPPET = `
    ${MARKER}
    app_deployment_target = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        pod_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if pod_target.nil? || Gem::Version.new(pod_target) < Gem::Version.new(app_deployment_target)
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_deployment_target
        end
      end
    end
`

const POST_INSTALL_OPENER = /^(\s*post_install do \|installer\|\n)/m

function addPodDeploymentTargetFloor(podfile) {
  if (podfile.includes(MARKER)) {
    return podfile
  }
  if (!POST_INSTALL_OPENER.test(podfile)) {
    throw new Error(
      'ios-pod-deployment-target-floor: Podfile has no `post_install do |installer|` block'
    )
  }
  return podfile.replace(POST_INSTALL_OPENER, `$1${FLOOR_SNIPPET}`)
}

module.exports = function withIosPodDeploymentTargetFloor(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = addPodDeploymentTargetFloor(cfg.modResults.contents)
    return cfg
  })
}

module.exports.addPodDeploymentTargetFloor = addPodDeploymentTargetFloor
