import { useState } from 'react'
import { Bot, LoaderCircle, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { DESIGN_MESSAGE_MAX_CHARS, type DesignMessage } from '../../../../shared/design-types'
import { designThread } from './design-conversation'
import { formatDesignTimestamp } from './design-format'

function MessageRow({
  message,
  nested
}: {
  message: DesignMessage
  nested: boolean
}): React.JSX.Element {
  const Icon = message.author === 'agent' ? Bot : User
  return (
    <div
      data-design-message={message.id}
      className={cn('flex items-start gap-2', nested && 'ml-6 border-l border-border pl-3')}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">
          {message.author === 'agent'
            ? translate('auto.components.design.thread.agent', 'Agent')
            : translate('auto.components.design.thread.you', 'You')}
          {' · '}
          {formatDesignTimestamp(message.at)}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.text}</p>
      </div>
    </div>
  )
}

/** A block's thread (blockId set) or the design's general conversation, with a composer. */
export function DesignThread({
  messages,
  blockId,
  placeholder,
  onSend,
  autoFocus = false
}: {
  messages: readonly DesignMessage[]
  blockId: string | undefined
  placeholder: string
  onSend: (text: string) => Promise<void>
  autoFocus?: boolean
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const thread = designThread(messages, blockId)

  const send = async (): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } catch {
      // Why: the caller already reported the failure; keeping the text lets the user retry.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {thread.length > 0 ? (
        <div className="space-y-3">
          {thread.map((entry) => (
            <div key={entry.message.id} className="space-y-2">
              <MessageRow message={entry.message} nested={false} />
              {entry.replies.map((reply) => (
                <MessageRow key={reply.id} message={reply} nested />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {translate('auto.components.design.thread.empty', 'No messages yet.')}
        </p>
      )}
      <div className="space-y-2">
        <Textarea
          value={text}
          autoFocus={autoFocus}
          maxLength={DESIGN_MESSAGE_MAX_CHARS}
          disabled={sending}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            const isMac = navigator.userAgent.includes('Mac')
            if (event.key === 'Enter' && (isMac ? event.metaKey : event.ctrlKey)) {
              event.preventDefault()
              void send()
            }
          }}
          className="min-h-16"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={sending || text.trim().length === 0}
            onClick={() => void send()}
          >
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {translate('auto.components.design.thread.send', 'Send')}
          </Button>
        </div>
      </div>
    </div>
  )
}
