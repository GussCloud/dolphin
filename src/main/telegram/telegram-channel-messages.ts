import { translateMain } from '../i18n/main-i18n'

// Why fill placeholders here too: translateMain returns the raw fallback before i18n init.
function translateWith(key: string, fallback: string, values: Record<string, string>): string {
  return translateMain(key, fallback, values).replace(
    /\{\{(\w+)\}\}/g,
    (placeholder, name: string) => values[name] ?? placeholder
  )
}

// User-facing Telegram text of the Claude channel; keys live under `telegram.channel` in every locale.
export const telegramChannelMessages = {
  sent: () => translateMain('telegram.channel.sent', 'Sent to Claude.'),
  unconfirmed: () =>
    translateMain(
      'telegram.channel.unconfirmed',
      'Claude did not confirm it received the message; check the terminal.'
    ),
  allowed: () => translateMain('telegram.channel.allowed', 'Allowed.'),
  denied: () => translateMain('telegram.channel.denied', 'Denied.'),
  permissionExpired: () =>
    translateMain(
      'telegram.channel.permissionExpired',
      'That permission request expired or was already answered.'
    ),
  privateChatOnly: () =>
    translateMain(
      'telegram.channel.privateChatOnly',
      'Permission requests can only be answered from your private chat with the bot.'
    ),
  severalClaudes: () =>
    translateMain(
      'telegram.channel.severalClaudes',
      'More than one Claude is connected. Reply to the message of the Claude that should get this.'
    ),
  replyToNotice: () =>
    translateMain(
      'telegram.channel.replyToNotice',
      'Several agents need you. Reply to the notice of the one this is for.'
    ),
  noAgent: () => translateMain('telegram.channel.noAgent', 'No agent received the message.'),
  unknownAction: () => translateMain('telegram.channel.unknownAction', 'Unrecognized action.'),
  permissionTitle: (toolName: string) =>
    translateWith('telegram.channel.permissionTitle', 'Claude asks permission: {{toolName}}', {
      toolName
    }),
  permissionTypedHint: (requestId: string) =>
    translateWith(
      'telegram.channel.permissionTypedHint',
      '(or reply "yes {{requestId}}" / "no {{requestId}}")',
      { requestId }
    ),
  yes: () => translateMain('telegram.channel.yes', 'Yes'),
  no: () => translateMain('telegram.channel.no', 'No'),
  approvalFallback: () =>
    translateMain(
      'telegram.channel.approvalFallback',
      'The Claude channel did not relay this permission request. Answer it here:'
    ),
  approveInChannel: () =>
    translateMain(
      'telegram.channel.approveInChannel',
      'Answer this permission in the Claude channel message.'
    )
}
