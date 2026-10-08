import type { AgentStatusEntry } from '../../shared/agent-status-types'
import type { TelegramAnswerablePrompt } from './telegram-answerable-prompt'

type AnsweredMark = { tag: string; stateStartedAt: number; interactivePrompt?: string }
const MAX_MARKS = 500

/** Prompts Telegram already answered whose pane has not moved on yet.
 *  Why: the row stays blocked until the agent's next hook, so a double tap, an
 *  Allow-then-Deny, or a replayed update would otherwise type into the next screen. */
export class TelegramAnsweredPrompts {
  private readonly marks = new Map<string, AnsweredMark>()

  isAnswered(entry: AgentStatusEntry, prompt: TelegramAnswerablePrompt): boolean {
    const mark = this.marks.get(entry.paneKey)
    if (!mark) {
      return false
    }
    if (
      mark.tag === prompt.tag &&
      mark.stateStartedAt === entry.stateStartedAt &&
      mark.interactivePrompt === entry.interactivePrompt
    ) {
      return true
    }
    // The pane moved on (new state or prompt): the mark has done its job.
    this.marks.delete(entry.paneKey)
    return false
  }

  record(entry: AgentStatusEntry, prompt: TelegramAnswerablePrompt): void {
    this.marks.delete(entry.paneKey)
    this.marks.set(entry.paneKey, {
      tag: prompt.tag,
      stateStartedAt: entry.stateStartedAt,
      ...(entry.interactivePrompt !== undefined
        ? { interactivePrompt: entry.interactivePrompt }
        : {})
    })
    for (const oldest of this.marks.keys()) {
      if (this.marks.size <= MAX_MARKS) {
        break
      }
      this.marks.delete(oldest)
    }
  }
}
