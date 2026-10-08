import { translateMain } from '../i18n/main-i18n'

// User-facing Telegram answer strings; literal keys so the catalogs and audits see them.
export const telegramAnswerText = {
  stale: () => translateMain('telegram.answer.stale', 'This question was already answered.'),
  alreadyAnswered: () =>
    translateMain('telegram.answer.alreadyAnswered', 'Already answered. Waiting for the agent.'),
  sent: () => translateMain('telegram.answer.sent', 'Answer sent.'),
  unconfirmed: () =>
    translateMain(
      'telegram.answer.unconfirmed',
      'The answer may have been sent. Check the terminal.'
    ),
  partlySent: () =>
    translateMain(
      'telegram.answer.partlySent',
      'The answer was only partly sent. Check the terminal.'
    ),
  textNotSubmitted: () =>
    translateMain(
      'telegram.answer.textNotSubmitted',
      'The text was typed but not submitted. Check the terminal.'
    ),
  notSent: () => translateMain('telegram.answer.notSent', 'Could not send the answer.'),
  busy: () => translateMain('telegram.answer.busy', 'Another answer is still being sent.'),
  noTerminal: () => translateMain('telegram.answer.noTerminal', 'The terminal is unavailable.'),
  noAgent: () =>
    translateMain(
      'telegram.answer.noAgent',
      'No active agent in that terminal. Nothing was typed.'
    ),
  useButtons: () =>
    translateMain(
      'telegram.answer.useButtons',
      'Use the buttons to answer this permission request.'
    ),
  noFreeText: () =>
    translateMain('telegram.answer.noFreeText', 'This question only accepts the offered options.'),
  incomplete: () =>
    translateMain('telegram.answer.incomplete', 'Answer every question before sending.'),
  answerInDolphin: () =>
    translateMain(
      'telegram.answer.answerInDolphin',
      'This prompt is too large for Telegram. Answer it in Dolphin.'
    ),
  structuredUnavailable: () =>
    translateMain('telegram.answer.structuredUnavailable', 'The chat session is unavailable.'),
  noWorktree: () =>
    translateMain('telegram.answer.noWorktree', 'No agent found for that workspace.'),
  ambiguousWorktree: () =>
    translateMain(
      'telegram.answer.ambiguousWorktree',
      'More than one agent in that workspace. Reply to the agent’s notice instead.'
    ),
  allow: () => translateMain('telegram.answer.allow', 'Allow'),
  deny: () => translateMain('telegram.answer.deny', 'Deny'),
  submit: () => translateMain('telegram.answer.submit', 'Send'),
  hintMultiSelect: () =>
    translateMain('telegram.answer.hintMultiSelect', 'Pick options, then tap Send.'),
  hintReply: () =>
    translateMain('telegram.answer.hintReply', 'Reply to this message to type an answer.')
} as const
