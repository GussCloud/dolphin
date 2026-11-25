import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { GREEN_ARTIFACT } from './green-e2e-develop-run.mjs'
import { IOS_BUILD_RECORD_ASSET } from './ios-beta-build-record.mjs'

const workflow = (name) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'))
const PLATFORM_WORKFLOWS = [
  'dolphin-windows-release',
  'dolphin-android-release',
  'dolphin-ios-release'
]
const CALLS = {
  desktop: './.github/workflows/dolphin-windows-release.yml',
  android: './.github/workflows/dolphin-android-release.yml',
  ios: './.github/workflows/dolphin-ios-release.yml'
}

describe('release workflows', () => {
  it.each(PLATFORM_WORKFLOWS)('%s is never started by a push', (name) => {
    const on = workflow(name).on
    expect(on.push).toBeUndefined()
    expect(on.workflow_call).toBeDefined()
  })

  it('leaves no manual path to a published desktop release', () => {
    expect(workflow('dolphin-windows-release').on.workflow_dispatch).toBeUndefined()
  })

  it('builds every desktop leg in parallel into one draft, published only after all uploaded', () => {
    const { jobs, on } = workflow('dolphin-windows-release')
    const createDraft = jobs.draft.steps.find(
      (step) => step.name === 'Create the draft GitHub release'
    )
    expect(createDraft.run).toContain('create-draft-release.mjs')
    for (const leg of ['build-win', 'build-win-arm64', 'build-mac']) {
      expect(jobs[leg].needs, leg).toBe('draft')
      expect(jobs[leg].env.TAG, leg).toBe('${{ needs.draft.outputs.tag }}')
    }
    expect(jobs.publish.needs).toEqual([
      'draft',
      'build-win',
      'build-win-arm64',
      'build-mac',
      'mac-update-manifest'
    ])
    expect(jobs.publish.if).toContain('inputs.publish')
    expect(on.workflow_call.inputs.publish.default).toBe(true)
    expect(jobs.publish.steps.at(-1).uses).toBe('./.github/actions/publish-desktop-release')
    const action = parse(readFileSync('.github/actions/publish-desktop-release/action.yml', 'utf8'))
    const steps = action.runs.steps.map((step) => step.run ?? '').join('\n')
    expect(steps).toContain(
      'verify-release-required-assets.mjs "$TAG" --platforms=mac,win,win-arm64'
    )
    expect(steps).toContain('--prerelease --latest=false')
  })

  it('packages each mac slice on its own runner and publishes one merged update manifest', () => {
    const { jobs } = workflow('dolphin-windows-release')
    const mac = jobs['build-mac']
    expect(mac.strategy.matrix.include).toEqual([
      { arch: 'x64', app_dir: 'mac', zip_suffix: 'mac.zip' },
      { arch: 'arm64', app_dir: 'mac-arm64', zip_suffix: 'arm64-mac.zip' }
    ])
    // Why: with fail-fast the surviving slice would be cancelled mid-notarization.
    expect(mac.strategy['fail-fast']).toBe(false)
    const pack = mac.steps.find((step) => step.name === 'Package macOS dmg and zip')
    expect(pack.env.DOLPHIN_MAC_ARCH).toBe('${{ matrix.arch }}')
    expect(pack.env.DOLPHIN_MAC_RELEASE).toBe('1')
    const upload = mac.steps.find((step) => step.name === 'Verify and upload release assets')
    // Why: a slice's own latest-mac.yml names only its files; on the release it would hide the other slice.
    expect(upload.run).toContain('files=("$dmg" "$dmg.blockmap" "$zip" "$zip.blockmap")')
    expect(upload.run).toContain(
      'gh release upload "$TAG" --repo "$GITHUB_REPOSITORY" "${files[@]}"'
    )
    expect(upload.run).toContain('xcrun stapler validate "$app"')
    expect(mac.steps.at(-1).with).toMatchObject({
      name: 'mac-update-manifest-${{ matrix.arch }}',
      path: 'dist/latest-mac.yml',
      'if-no-files-found': 'error'
    })

    const merge = jobs['mac-update-manifest']
    expect(merge.needs).toEqual(['draft', 'build-mac'])
    expect(merge.if).toBe("github.repository == 'GussCloud/dolphin'")
    const downloads = merge.steps.filter((step) =>
      step.uses?.startsWith('actions/download-artifact@')
    )
    expect(downloads.map((step) => step.with.name)).toEqual([
      'mac-update-manifest-x64',
      'mac-update-manifest-arm64'
    ])
    const run = merge.steps.at(-1).run
    expect(run).toContain('node config/scripts/merge-mac-update-manifests.mjs')
    expect(run).toMatch(/mac-x64\/latest-mac\.yml"\s+"\$RUNNER_TEMP\/mac-arm64\/latest-mac\.yml"/)
    expect(run).toContain(
      'gh release upload "$TAG" --repo "$GITHUB_REPOSITORY" dist/latest-mac.yml'
    )
  })

  it('compiles native modules once per Windows leg and spares arm64 the Visual Studio search', () => {
    const { jobs } = workflow('dolphin-windows-release')
    for (const leg of ['build-win', 'build-win-arm64']) {
      const pack = jobs[leg].steps.find((step) => step.name?.startsWith('Package Windows'))
      expect(pack.run, leg).toContain('ensure-native-runtime.mjs --runtime=electron')
      expect(pack.env.DOLPHIN_REUSE_PREPARED_NATIVE_RUNTIME, leg).toBe('1')
    }
    const steps = jobs['build-win-arm64'].steps
    const names = steps.map((step) => step.name)
    const pin = steps.find((step) => step.name === 'Tell node-gyp where Visual Studio is')
    // Why before the install: the first node-gyp run is a dependency's install script.
    expect(names.indexOf(pin.name)).toBeLessThan(names.indexOf('Install dependencies'))
    for (const variable of ['VCINSTALLDIR', 'VSCMD_VER', 'WindowsSDKVersion']) {
      expect(pin.run).toContain(`"${variable}=`)
    }
    // Why exit 0: without the variables node-gyp falls back to its own detection.
    expect(pin.run).toMatch(/::warning::[\s\S]*exit 0/)
    // Why the wait matters: build:release bundles the mobile web page from mobile/node_modules.
    const mobile = steps.find(
      (step) => step.uses === './.github/actions/install-mobile-dependencies'
    )
    expect(mobile).toMatchObject({ id: 'mobile-deps', background: true })
    const waitIndex = steps.findIndex((step) => step.wait === 'mobile-deps')
    expect(steps.indexOf(mobile)).toBeLessThan(names.indexOf('Install dependencies'))
    expect(waitIndex).toBeGreaterThan(names.indexOf('Install dependencies'))
    expect(waitIndex).toBeLessThan(names.indexOf('Build app'))
    const cache = steps.find((step) => step.name === 'Cache node-gyp headers')
    // Why not package.json: the release version stamp rewrites it, so the key would never hit.
    expect(cache.with.key).toBe('node-gyp-headers-win-arm64-${{ steps.node.outputs.node-version }}')
    expect(names.indexOf('Stamp the release version')).toBeLessThan(names.indexOf(cache.name))
  })

  it.each([
    ['release-beta', true],
    ['release-promote', false]
  ])('%s calls the platform workflows (prerelease=%s)', (name, prerelease) => {
    const { jobs, on } = workflow(name)
    expect(Object.keys(on).sort()).toEqual(
      name === 'release-beta' ? ['push', 'workflow_dispatch'] : ['workflow_dispatch']
    )
    expect(on.workflow_dispatch.inputs.app.options).toEqual(['desktop', 'mobile', 'both'])
    for (const [job, uses] of Object.entries(CALLS)) {
      expect(jobs[job].uses).toBe(uses)
      expect(jobs[job].secrets).toBe('inherit')
    }
    expect(jobs.desktop.with.prerelease).toBe(prerelease)
    expect(jobs.android.with.prerelease).toBe(prerelease)
  })

  it('gates every promote build behind the production environment', () => {
    const { jobs } = workflow('release-promote')
    expect(jobs.approve.environment).toBe('production')
    for (const job of Object.keys(CALLS)) {
      expect(jobs[job].needs).toContain('approve')
    }
    const resolve = jobs.resolve.steps.map((step) => step.run ?? '').join('\n')
    expect(
      resolve.match(/verify-release-commit\.mjs "\$sha" --branch develop --require-checks/g)
    ).toHaveLength(2)
    // Why: a tests- or CI-only merge cuts no rc; the promote must still run develop's tests.
    expect(
      resolve.match(/beta-release-scope\.mjs --promotion-commit (desktop|mobile)/g)
    ).toHaveLength(2)
    expect(jobs.resolve.steps[0].with['fetch-depth']).toBe(0)
  })

  it('passes every input a called workflow requires', () => {
    for (const name of ['release-beta', 'release-promote']) {
      const { jobs } = workflow(name)
      for (const [job, uses] of Object.entries(CALLS)) {
        const called = workflow(uses.replace('./.github/workflows/', '').replace('.yml', ''))
        const required = Object.entries(called.on.workflow_call.inputs)
          .filter(([, input]) => input.required)
          .map(([key]) => key)
        for (const key of required) {
          expect(jobs[job].with, `${name} ${job} ${key}`).toHaveProperty(key)
        }
      }
    }
  })

  it('cuts a beta on every push to develop and on no other branch', () => {
    const { on, concurrency, jobs } = workflow('release-beta')
    expect(on.push).toEqual({ branches: ['develop'] })
    expect(concurrency.cancel_in_progress ?? concurrency['cancel-in-progress']).toBe(false)
    const resolve = jobs.resolve.steps.map((step) => step.run ?? '').join('\n')
    expect(resolve).toContain('verify-release-commit.mjs "$sha" --branch develop')
    const commit = jobs.resolve.steps.find((step) => step.id === 'commit')
    expect(commit.env.REF).toContain("github.event_name == 'push' && github.sha")
  })

  it('gates each beta build on the scope script', () => {
    const { jobs } = workflow('release-beta')
    const scope = jobs.resolve.steps.find((step) => step.id === 'scope')
    expect(scope.run).toContain('beta-release-scope.mjs "$SHA"')
    expect(scope.run).toContain('beta-release-scope.mjs --app "$APP"')
    expect(jobs.resolve.outputs.desktop).toBe('${{ steps.scope.outputs.desktop }}')
    expect(jobs.resolve.outputs.mobile).toBe('${{ steps.scope.outputs.mobile }}')
    expect(jobs.desktop.if).toBe("needs.resolve.outputs.desktop == 'true'")
    expect(jobs.android.if).toBe("needs.resolve.outputs.mobile == 'true'")
    expect(jobs.ios.if).toBe("needs.resolve.outputs.mobile == 'true'")
    const versionSteps = jobs.resolve.steps.filter(
      (step) => step.id === 'desktop' || step.id === 'mobile'
    )
    expect(versionSteps.map((step) => step.if)).toEqual([
      "steps.scope.outputs.desktop == 'true'",
      "steps.scope.outputs.mobile == 'true'"
    ])
  })

  it('publishes nothing from a promote until the whole e2e suite is green on the promoted commit', () => {
    const { jobs } = workflow('release-promote')
    expect(jobs.e2e.uses).toBe('./.github/workflows/e2e.yml')
    expect(jobs.e2e.with).toEqual({ ref: '${{ needs.resolve.outputs.target_sha }}', retries: '1' })
    expect(jobs.e2e_wsl.uses).toBe('./.github/workflows/windows-wsl-e2e.yml')
    expect(jobs.e2e_wsl.with.retries).toBe('1')
    // Why the builds may run beside the suite: they only stage, never publish.
    expect(jobs.desktop.with.publish).toBe(false)
    expect(jobs.android.with.publish_github_release).toBe(false)
    expect(jobs.ios.with).not.toHaveProperty('distribute_external')
    const publishers = {
      'desktop-publish': "needs.desktop.result == 'success'",
      'android-publish': "needs.android.result == 'success'",
      'ios-distribute': "needs.ios.result == 'success'"
    }
    for (const [job, built] of Object.entries(publishers)) {
      expect(jobs[job].needs, job).toEqual(expect.arrayContaining(['approve', 'e2e-gate']))
      // Why every result is named: e2e and ios can be skipped on purpose, so the default
      // "every need succeeded" is gone and each publish must still wait for approval and the gate.
      expect(jobs[job].if, job).toContain(
        "!cancelled() && needs.approve.result == 'success' && needs.e2e-gate.result == 'success'"
      )
      expect(jobs[job].if, job).toContain(built)
      expect(jobs[job].if, job).not.toMatch(/always\(\)|!failure\(\)/)
    }
    const distribute = jobs['ios-distribute'].steps.map((step) => step.run ?? '').join('\n')
    expect(distribute).toContain('fastlane ios distribute_testflight')
    const androidPublish = jobs['android-publish'].steps.map((step) => step.uses ?? '')
    expect(androidPublish).toContain('./.github/actions/publish-android-release')
  })

  it('runs the suite in a promote unless E2E develop already passed on that exact commit', () => {
    const { jobs, on } = workflow('release-promote')
    const lookup = jobs.resolve.steps.find((step) => step.id === 'e2e_green')
    expect(lookup.run).toBe('node config/scripts/green-e2e-develop-run.mjs "$SHA"')
    expect(lookup.env.SHA).toBe('${{ steps.target.outputs.sha }}')
    expect(lookup.if).toBe('${{ !inputs.force_e2e }}')
    expect(on.workflow_dispatch.inputs.force_e2e.default).toBe(false)
    expect(jobs.resolve.outputs.e2e_green_run).toBe('${{ steps.e2e_green.outputs.url }}')
    expect(jobs.resolve.permissions).toEqual({ contents: 'read', actions: 'read' })
    for (const job of ['e2e', 'e2e_wsl']) {
      expect(jobs[job].if, job).toBe("needs.resolve.outputs.e2e_green_run == ''")
    }
    // Why the record matters: it is written only after the suite and the WSL lane both passed.
    const record = workflow('e2e-develop').jobs.record
    expect(record.if).toBe(
      "${{ needs.suite.result == 'success' && needs.wsl.result == 'success' }}"
    )
    expect(record.steps.at(-1).with.name).toBe(GREEN_ARTIFACT)
    expect(jobs['e2e-gate'].needs).toEqual(['resolve', 'e2e', 'e2e_wsl'])
    expect(jobs['e2e-gate'].if).toBe("${{ !cancelled() && needs.resolve.result == 'success' }}")
  })

  it.each([
    [{ SUITE: 'success', WSL: 'success', GREEN_RUN: '' }, 0],
    [{ SUITE: 'skipped', WSL: 'skipped', GREEN_RUN: 'https://example.test/run/1' }, 0],
    [{ SUITE: 'skipped', WSL: 'skipped', GREEN_RUN: '' }, 1],
    [{ SUITE: 'failure', WSL: 'success', GREEN_RUN: '' }, 1],
    [{ SUITE: 'success', WSL: 'failure', GREEN_RUN: '' }, 1],
    [{ SUITE: 'cancelled', WSL: 'success', GREEN_RUN: '' }, 1],
    // Why a green run does not excuse a suite that ran here and failed.
    [{ SUITE: 'failure', WSL: 'skipped', GREEN_RUN: 'https://example.test/run/1' }, 1],
    [{ SUITE: 'success', WSL: 'skipped', GREEN_RUN: 'https://example.test/run/1' }, 1]
  ])('the promote e2e gate given %j exits %i', (env, status) => {
    const gate = workflow('release-promote').jobs['e2e-gate'].steps[0]
    expect(Object.keys(gate.env).sort()).toEqual(['GREEN_RUN', 'SUITE', 'WSL'])
    const result = spawnSync('bash', ['-c', gate.run], {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8'
    })
    expect(result.status, result.stdout + result.stderr).toBe(status)
  })

  it('distributes the TestFlight build the beta uploaded and compiles one only as a fallback', () => {
    const beta = workflow('release-beta').jobs['ios-record']
    expect(beta.needs).toEqual(['resolve', 'android', 'ios'])
    // Why no condition: a failed or skipped mobile build must record nothing.
    expect(beta.if).toBeUndefined()
    const write = beta.steps.at(-1)
    expect(write.run).toContain('ios-beta-build-record.mjs write "$VERSION" "$BUILD_NUMBER" "$SHA"')
    expect(write.run).toContain('gh release upload "$TAG"')
    expect(write.run).toContain(IOS_BUILD_RECORD_ASSET)
    expect(write.env.BUILD_NUMBER).toBe('${{ needs.ios.outputs.build_number }}')

    const { jobs, on } = workflow('release-promote')
    const read = jobs.resolve.steps.find((step) => step.id === 'ios_build')
    expect(read.if).toBe("${{ inputs.app != 'desktop' && !inputs.rebuild_ios }}")
    expect(read.run).toContain(`--pattern ${IOS_BUILD_RECORD_ASSET}`)
    expect(read.run).toContain(
      'ios-beta-build-record.mjs read "$record" --version "$VERSION" --sha "$RC_SHA"'
    )
    expect(read.env.RC_SHA).toBe('${{ steps.mobile_commit.outputs.rc_sha }}')
    expect(on.workflow_dispatch.inputs.rebuild_ios.default).toBe(false)

    const reuse = jobs['ios-reuse']
    expect(reuse.needs).toEqual(['resolve', 'approve'])
    const verify = reuse.steps.find((step) => step.id === 'verify')
    expect(verify.run).toContain('fastlane ios verify_testflight_build')
    // Why: a build TestFlight no longer holds must fall back to compiling, not fail the promote.
    expect(verify['continue-on-error']).toBe(true)
    expect(reuse.outputs.build_number).toBe(
      "${{ steps.verify.outcome == 'success' && needs.resolve.outputs.ios_beta_build || '' }}"
    )
    expect(readFileSync('mobile/fastlane/Fastfile', 'utf8')).toContain(
      'lane :verify_testflight_build'
    )

    expect(jobs.ios.needs).toEqual(['resolve', 'approve', 'ios-reuse'])
    expect(jobs.ios.if).toBe(
      "${{ !cancelled() && needs.approve.result == 'success' && inputs.app != 'desktop' && needs.ios-reuse.outputs.build_number == '' }}"
    )
    const distribute = jobs['ios-distribute']
    expect(distribute.if).toContain(
      "(needs.ios.result == 'skipped' && needs.ios-reuse.outputs.build_number != '')"
    )
    const lane = distribute.steps.at(-1)
    expect(lane.env.VERSION).toBe(
      '${{ needs.ios.outputs.version || needs.resolve.outputs.mobile_version }}'
    )
    expect(lane.env.BUILD_NUMBER).toBe(
      '${{ needs.ios.outputs.build_number || needs.ios-reuse.outputs.build_number }}'
    )
  })

  it('builds the Android native code through ccache and skips release lint', () => {
    const steps = workflow('dolphin-android-release').jobs['build-android'].steps
    const names = steps.map((step) => step.name)
    const enable = steps.find((step) => step.name === 'Enable ccache for the native build')
    for (const line of [
      'CMAKE_C_COMPILER_LAUNCHER=ccache',
      'CMAKE_CXX_COMPILER_LAUNCHER=ccache',
      // Why: the default check is the compiler's mtime, which changes with every runner image.
      'CCACHE_COMPILERCHECK=%compiler% --version'
    ]) {
      expect(enable.run).toContain(`echo "${line}"`)
    }
    const cache = steps.find((step) => step.name === 'Restore the native build cache')
    expect(cache.with.path).toBe('~/.ccache-dolphin-android')
    // Why run_id: actions/cache never overwrites a key, so each run saves its own and restores the newest.
    expect(cache.with.key).toMatch(/^ccache-android-.*-\$\{\{ github\.run_id \}\}$/)
    const build = steps.find((step) => step.name === 'Build Android release APK')
    expect(names.indexOf(cache.name)).toBeLessThan(names.indexOf(build.name))
    expect(build.run).toContain('-PreactNativeArchitectures=armeabi-v7a,arm64-v8a')
    expect(build.run).toContain(
      '-x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease'
    )
  })

  it('beta still publishes inside the platform workflows', () => {
    const { jobs } = workflow('release-beta')
    expect(jobs.desktop.with).not.toHaveProperty('publish')
    expect(jobs.android.with).not.toHaveProperty('publish_github_release')
    const android = workflow('dolphin-android-release').jobs['build-android'].steps
    expect(android.find((step) => step.name === 'Publish GitHub release').uses).toBe(
      './.github/actions/publish-android-release'
    )
  })

  it('runs the whole suite on every develop merge and reports failures and flaky tests', () => {
    const nightly = workflow('e2e-develop')
    expect(nightly.on.schedule).toEqual([{ cron: '13 6,16 * * *' }])
    expect(nightly.on.push).toEqual({ branches: ['develop'] })
    expect(nightly.jobs.suite.uses).toBe('./.github/workflows/e2e.yml')
    // Why no test_files: an empty list is what makes e2e.yml run every shard and lane.
    // Why decide's sha: schedules fire from main, where github.sha is main, not develop.
    expect(nightly.jobs.suite.with).toEqual({
      ref: '${{ needs.decide.outputs.sha }}',
      retries: '1'
    })
    expect(nightly.jobs.wsl.uses).toBe('./.github/workflows/windows-wsl-e2e.yml')
    expect(nightly.jobs.wsl.with).toEqual({ ref: '${{ needs.decide.outputs.sha }}', retries: '1' })
    const flakyRun = nightly.jobs.flaky.steps.map((step) => step.run ?? '').join('\n')
    expect(flakyRun).toContain('select(.title == "Flaky e2e")')
    const decideRun = nightly.jobs.decide.steps.map((step) => step.run ?? '').join('\n')
    expect(decideRun).toContain('commits/develop')
    expect(JSON.stringify(nightly)).not.toContain('github.sha')
    expect(nightly.jobs.record.needs).toEqual(['decide', 'suite', 'wsl'])
    expect(nightly.jobs.report.permissions).toEqual({ contents: 'read', issues: 'write' })
    expect(nightly.concurrency).toEqual({ group: 'e2e-develop', 'cancel-in-progress': false })
  })

  it('retries only in the full-suite runs, and reports each retried pass as flaky', () => {
    for (const name of ['e2e', 'windows-wsl-e2e']) {
      const { env, on } = workflow(name)
      expect(env.DOLPHIN_E2E_RETRIES, name).toBe("${{ inputs.retries || '0' }}")
      expect(on.workflow_call.inputs.retries.required, name).toBe(false)
    }
    // Why PRs stay at 0: a spec a PR writes or edits must pass on its first attempt.
    expect(JSON.stringify(workflow('pr'))).not.toContain('retries')
    const config = readFileSync('tests/playwright.config.ts', 'utf8')
    expect(config).toContain("process.env.DOLPHIN_E2E_RETRIES ?? '0'")
    expect(config).toContain('./e2e/flaky-annotation-reporter.ts')
    const reporter = readFileSync('tests/e2e/flaky-annotation-reporter.ts', 'utf8')
    expect(reporter).toContain("test.outcome() !== 'flaky'")
    expect(reporter).toContain('::warning title=Flaky e2e::')
  })

  it('moves main after a promote, never by force', () => {
    const { jobs } = workflow('release-promote')
    const job = jobs['fast-forward-main']
    expect(job.needs).toEqual([
      'resolve',
      'e2e-gate',
      'desktop-publish',
      'android-publish',
      'ios-distribute'
    ])
    // Why each result is named: a skipped publish job is not a failure, and main must never
    // move past an app that was not published.
    expect(job.if).toContain("needs.e2e-gate.result == 'success'")
    expect(job.if).toContain(
      "(inputs.app == 'mobile' || needs.desktop-publish.result == 'success')"
    )
    expect(job.if).toContain(
      "(needs.android-publish.result == 'success' && needs.ios-distribute.result == 'success')"
    )
    expect(job.permissions).toEqual({ contents: 'write' })
    const run = job.steps.map((step) => step.run ?? '').join('\n')
    expect(run).toContain('git push origin "$new_main:refs/heads/main"')
    expect(run).not.toMatch(/--force|\s-f\b|\+\$target|\+refs/)
    expect(run).toContain('::error::The release IS published, but main was not moved')
  })
})
