import type { TelegramNoticeButton } from './telegram-inbound'
import { telegramChannelMessages } from './telegram-channel-messages'

const PERMISSION_ACTION_RE = /^chp-(allow|deny)-([a-km-z]{5})$/
// Typed verdicts in every UI locale ("sim abcde", "no abcde", "はい abcde"…); ids skip `l`.
const ALLOW_WORDS = ['y', 'yes', 's', 'sim', 'si', 'sí', 'oui', 'はい', '네', '예', '是', '好']
const DENY_WORDS = ['n', 'no', 'não', 'nao', 'non', 'いいえ', '아니요', '아니오', '否', '不']
const PERMISSION_TEXT_RE = /^\s*(\S+)\s+([a-km-z]{5})\s*$/i
const PREVIEW_MAX_CHARS = 800
const DESCRIPTION_MAX_CHARS = 400

export type TelegramChannelPermissionVerdict = { requestId: string; behavior: 'allow' | 'deny' }

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Plain text: the bridge escapes it for Telegram's HTML parse mode. */
export function formatChannelPermissionNotice(request: {
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}): { text: string; buttons: TelegramNoticeButton[][] } {
  const lines = [`🔐 ${telegramChannelMessages.permissionTitle(request.toolName)}`]
  const description = request.description.trim()
  if (description) {
    lines.push(clip(description, DESCRIPTION_MAX_CHARS))
  }
  const preview = request.inputPreview.trim()
  if (preview) {
    lines.push(clip(preview, PREVIEW_MAX_CHARS))
  }
  lines.push(telegramChannelMessages.permissionTypedHint(request.requestId))
  return {
    text: lines.join('\n'),
    buttons: [
      [
        { label: telegramChannelMessages.yes(), action: `chp-allow-${request.requestId}` },
        { label: telegramChannelMessages.no(), action: `chp-deny-${request.requestId}` }
      ]
    ]
  }
}

export function parseChannelPermissionAction(
  action: string
): TelegramChannelPermissionVerdict | null {
  const match = PERMISSION_ACTION_RE.exec(action)
  return match ? { requestId: match[2], behavior: match[1] === 'allow' ? 'allow' : 'deny' } : null
}

export function parseChannelPermissionText(text: string): TelegramChannelPermissionVerdict | null {
  const match = PERMISSION_TEXT_RE.exec(text)
  if (!match) {
    return null
  }
  const word = match[1].toLowerCase()
  const requestId = match[2].toLowerCase()
  if (ALLOW_WORDS.includes(word)) {
    return { requestId, behavior: 'allow' }
  }
  return DENY_WORDS.includes(word) ? { requestId, behavior: 'deny' } : null
}
