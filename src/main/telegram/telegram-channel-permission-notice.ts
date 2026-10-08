import type { TelegramNoticeButton } from './telegram-inbound'

const PERMISSION_ACTION_RE = /^chp-(allow|deny)-([a-km-z]{5})$/
// Accepts the reply typed by hand, e.g. "sim abcde", "não abcde", "yes abcde".
const PERMISSION_TEXT_RE = /^\s*(y|yes|s|sim|n|no|não|nao)\s+([a-km-z]{5})\s*$/i
const PREVIEW_MAX_CHARS = 800
const DESCRIPTION_MAX_CHARS = 400

export type TelegramChannelPermissionVerdict = { requestId: string; behavior: 'allow' | 'deny' }

export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function formatChannelPermissionNotice(request: {
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}): { text: string; buttons: TelegramNoticeButton[][] } {
  const lines = [
    `🔐 <b>Claude pede permissão</b>: <code>${escapeTelegramHtml(request.toolName)}</code>`
  ]
  const description = request.description.trim()
  if (description) {
    lines.push(escapeTelegramHtml(clip(description, DESCRIPTION_MAX_CHARS)))
  }
  const preview = request.inputPreview.trim()
  if (preview) {
    lines.push(`<pre>${escapeTelegramHtml(clip(preview, PREVIEW_MAX_CHARS))}</pre>`)
  }
  lines.push(`<i>ou responda "sim ${request.requestId}" / "não ${request.requestId}"</i>`)
  return {
    text: lines.join('\n'),
    buttons: [
      [
        { label: 'Sim', action: `chp-allow-${request.requestId}` },
        { label: 'Não', action: `chp-deny-${request.requestId}` }
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
  return {
    requestId: match[2].toLowerCase(),
    behavior: word.startsWith('y') || word.startsWith('s') ? 'allow' : 'deny'
  }
}
