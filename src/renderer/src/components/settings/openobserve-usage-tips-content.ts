import { translate } from '@/i18n/i18n'
import { OPENOBSERVE_CLI_COMMAND } from '../../../../shared/openobserve-cli'

export type OpenObserveCommandExample = {
  command: string
  description: string
}

const cli = OPENOBSERVE_CLI_COMMAND

// Why functions: the catalog must be read after the active language has loaded.
export function getOpenObserveCommandExamples(): OpenObserveCommandExample[] {
  return [
    {
      command: `${cli} stream list`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleStreamList',
        'List the log, metric and trace streams you can query.'
      )
    },
    {
      command: `${cli} stream schema <stream>`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleStreamSchema',
        'See the fields of a stream before writing a query.'
      )
    },
    {
      command: `${cli} search run --stream <stream> --where "level='ERROR'" --since 1h --limit 20`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleSearch',
        'Find the most recent errors in a log stream.'
      )
    },
    {
      command: `${cli} metrics query-range --query 'up' --since 1h --step 1m`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleMetrics',
        'Query metrics over time with PromQL.'
      )
    },
    {
      command: `${cli} trace search --stream <stream> --since 1h --limit 20`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleTraces',
        'Find recent distributed traces.'
      )
    },
    {
      command: `${cli} doctor`,
      description: translate(
        'auto.components.settings.openObserveUsageTips.exampleDoctor',
        'Check the configuration, the sign-in and the connection to the server.'
      )
    }
  ]
}

export function getOpenObserveUsageTips(): string[] {
  return [
    translate(
      'auto.components.settings.openObserveUsageTips.tipAskAgent',
      'With the skill installed, just ask the agent in plain words, for example: "show the errors from the checkout service in the last hour".'
    ),
    translate(
      'auto.components.settings.openObserveUsageTips.tipBoundQueries',
      'Always limit the time window (--since 1h) and the number of rows (--limit 20). Wide searches are slow and expensive.'
    ),
    translate(
      'auto.components.settings.openObserveUsageTips.tipDiscoverFirst',
      'List the streams and read their fields before querying; the CLI does not guess stream or field names.'
    ),
    translate(
      'auto.components.settings.openObserveUsageTips.tipPromQl',
      'Metrics use PromQL, not SQL. In SQL, put stream names in double quotes, such as FROM "default".'
    ),
    translate(
      'auto.components.settings.openObserveUsageTips.tipEnvOverride',
      'A .env file in the project folder, or OPENOBSERVE_* environment variables, take priority over the settings saved here.'
    ),
    translate(
      'auto.components.settings.openObserveUsageTips.tipUpgradeSkill',
      'After updating the CLI, update the skill too, then restart the agent so it loads the new version.'
    )
  ]
}
