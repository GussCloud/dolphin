// Phone-facing copy for the device-code `az login`: what Telegram and the mobile push show.
import { translateMain } from '../i18n/main-i18n'
import { escapeAndClipTelegramText, escapeTelegramHtml } from '../telegram/telegram-agent-notice'
import type {
  AzureCliDeviceCodeOutcome,
  AzureCliDeviceCodePrompt
} from './azure-cli-device-code-events'

const ERROR_MAX_CHARS = 200

/** Escapes the translated sentence, then splices in `html` values, which are already safe. */
function translateHtml(key: string, fallback: string, html: Record<string, string> = {}): string {
  const placeholders = Object.fromEntries(Object.keys(html).map((name) => [name, `{{${name}}}`]))
  let text = escapeTelegramHtml(translateMain(key, fallback, placeholders))
  for (const [name, value] of Object.entries(html)) {
    text = text.replaceAll(`{{${name}}}`, value)
  }
  return text
}

function hostLine(hostName: string): string {
  return translateHtml('azureCliDeviceCode.telegram.host', 'Computer: {{host}}', {
    host: escapeTelegramHtml(hostName)
  })
}

export function azureCliDeviceCodePromptHtml(
  prompt: AzureCliDeviceCodePrompt,
  hostName: string,
  expiresAtLabel: string
): string {
  const url = escapeTelegramHtml(prompt.verificationUrl)
  return [
    `🔐 <b>${translateHtml('azureCliDeviceCode.telegram.title', 'Azure sign-in needed')}</b>`,
    hostLine(hostName),
    '',
    translateHtml('azureCliDeviceCode.telegram.open', '1. Open {{url}}', {
      url: `<a href="${url}">${url}</a>`
    }),
    translateHtml('azureCliDeviceCode.telegram.enter', '2. Enter the code {{code}}', {
      code: `<code>${escapeTelegramHtml(prompt.userCode)}</code>`
    }),
    '',
    translateHtml('azureCliDeviceCode.telegram.expires', 'The code is valid until {{time}}.', {
      time: escapeTelegramHtml(expiresAtLabel)
    })
  ].join('\n')
}

/** The resolved message never repeats the code: it is single-use and must not linger in chats. */
export function azureCliDeviceCodeOutcomeHtml(
  outcome: AzureCliDeviceCodeOutcome,
  hostName: string
): string {
  const headline = (icon: string, key: string, fallback: string): string =>
    `${icon} <b>${translateHtml(key, fallback)}</b>`
  switch (outcome.outcome) {
    case 'renewed':
      return [
        headline('✅', 'azureCliDeviceCode.telegram.renewed', 'Azure session renewed'),
        hostLine(hostName)
      ].join('\n')
    case 'expired':
      return [
        headline('⌛', 'azureCliDeviceCode.telegram.expired', 'Azure sign-in code expired'),
        hostLine(hostName),
        translateHtml(
          'azureCliDeviceCode.telegram.expiredDetail',
          'Nobody entered the code in time. Tap New code to try again.'
        )
      ].join('\n')
    case 'failed':
      return [
        headline('⚠️', 'azureCliDeviceCode.telegram.failed', 'Azure sign-in failed'),
        hostLine(hostName),
        ...(outcome.error ? [escapeAndClipTelegramText(outcome.error, ERROR_MAX_CHARS)] : []),
        translateHtml('azureCliDeviceCode.telegram.failedDetail', 'Tap New code to try again.')
      ].join('\n')
    case 'cancelled':
      return [
        headline('✖', 'azureCliDeviceCode.telegram.cancelled', 'Azure sign-in cancelled'),
        hostLine(hostName)
      ].join('\n')
  }
}

export function azureCliDeviceCodeNewCodeLabel(): string {
  return translateMain('azureCliDeviceCode.telegram.newCode', 'New code')
}

export function azureCliDeviceCodeNewCodeAck(): string {
  return translateMain('azureCliDeviceCode.telegram.newCodeAck', 'Requesting a new code…')
}

export function azureCliDeviceCodePush(prompt: AzureCliDeviceCodePrompt): {
  title: string
  body: string
} {
  return {
    title: translateMain('azureCliDeviceCode.push.title', 'Azure sign-in'),
    body: translateMain('azureCliDeviceCode.push.body', 'Open {{url}} and enter {{code}}', {
      url: prompt.verificationUrl,
      code: prompt.userCode
    })
  }
}

export function azureCliDeviceCodeNoLongerNeeded(): string {
  return translateMain('azureCliDeviceCode.telegram.noLongerNeeded', 'No longer needed.')
}

export function azureCliDeviceCodeNewCodeFailed(): string {
  return translateHtml('azureCliDeviceCode.telegram.newCodeFailed', 'Could not get a new code.')
}
