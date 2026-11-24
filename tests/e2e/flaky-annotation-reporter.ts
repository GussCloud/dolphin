import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter'

/** Marks each test that failed and then passed on retry, so CI can collect them into one issue. */
export default class FlakyAnnotationReporter implements Reporter {
  private root: Suite | null = null

  onBegin(_config: FullConfig, suite: Suite): void {
    this.root = suite
  }

  onEnd(_result: FullResult): void {
    for (const test of this.root?.allTests() ?? []) {
      if (test.outcome() !== 'flaky') {
        continue
      }
      const where = `${test.location.file.replace(`${process.cwd()}/`, '')}:${test.location.line}`
      const title = test.titlePath().filter(Boolean).slice(1).join(' › ')
      // The title is the marker the e2e-develop flaky job collects.
      console.log(`::warning title=Flaky e2e::${where} › ${title}`)
    }
  }
}
