import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const sessionChatEn = {
  // Composer
  removeImage: 'Remove image',
  composerPlaceholder: 'Message, @files, /commands',
  attachImage: 'Attach image',
  stopDictation: 'Stop dictation',
  dictate: 'Dictate',
  sendMessage: 'Send message',

  // Transcript
  loadEarlierMessages: 'Load earlier messages',
  scrollToLatest: 'Scroll to latest',
  collapseTools: 'Collapse',
  expandTools: 'Tools',
  stopAgent: 'Stop the agent',
  stop: 'Stop',

  // Empty and error states (desktop components.native-chat.state)
  emptyStateAgentFallback: 'the agent',
  emptyStateTitle: 'Start a chat with {agent}',
  emptyStateSubtitle: 'Ask {agent} to inspect code, explain output, or make a change.',
  loadErrorTitle: 'Could not load conversation',
  loadErrorSubtitle:
    'The transcript could not be read. Toggle back to the terminal to keep working.',

  // Turn status (desktop components.native-chat.status)
  turnThinking: 'Thinking',
  turnWorkingFor: 'Working for {duration}',
  turnWorkedFor: 'Worked for {duration}',
  turnToggleDetails: 'Toggle turn details',
  turnResponding: 'Agent is responding',

  // Tool runs (desktop components.native-chat.tool)
  toolRunningPreview: 'Running {preview}',
  toolRunningCommand: 'Running command',
  toolRunningNamedPreview: 'Running {toolName} {preview}',
  toolRunningNamed: 'Running {toolName}',
  toolResult: 'Result',
  toolCallCount: { one: '{count} tool call', other: '{count} tool calls' },
  toolMoreCalls: { one: '… {count} more tool call', other: '… {count} more tool calls' },

  // Messages
  attachedImage: 'Attached image',
  imageFallback: 'image',

  // Permission card (desktop components.native-chat.approval)
  cancel: 'Cancel',
  permissionReasonLabel: 'Reason: ',
  permissionBlockedPathLabel: 'Blocked path: ',
  permissionAskRuleLabel: 'Ask rule: ',
  permissionPlanFile: 'Plan file: {path}',
  permissionAllowToolTitle: 'Allow {tool}?',
  permissionAllow: 'Allow',
  permissionDeny: 'Deny',
  permissionAllowAlways: 'Allow always',
  permissionRequested: 'Permission requested',

  // Questions and asks
  submit: 'Submit',
  next: 'Next',
  questionSubmitSelected: 'Submit selected options',
  questionSubmitCount: 'Submit ({count})',
  questionOrTypeReply: 'Or type a reply…',
  questionTypeReply: 'Type your reply…',
  questionSendReply: 'Send reply',
  questionChooseOption: 'Choose an option',
  askOther: 'Other…',
  askTypeAnswer: 'Type your answer',

  // Session options (desktop components.native-chat.composer)
  optionModel: 'Model',
  optionEffort: 'Effort',
  optionFastMode: 'Fast mode',
  optionThinking: 'Thinking',
  optionOptions: 'Options',
  optionOn: 'On',
  optionOff: 'Off',
  optionNotSet: 'Not set',
  optionValueFast: 'Fast',
  optionValueMinimal: 'Minimal',
  optionValueLow: 'Low',
  optionValueMedium: 'Medium',
  optionValueHigh: 'High',
  optionValueXhigh: 'Extra high',
  optionValueMax: 'Max',
  optionValueUltra: 'Ultra',
  optionSetWhenSessionStarts: 'Set when the session starts.',
  optionAvailableAfterSessionStarts: 'Available after the session starts.',
  optionModelPillAccessibleName: 'Model, {label}',
  optionClosePicker: 'Close picker',
  optionBackToModels: 'Back to models',
  optionSelectModel: 'Select model',
  optionSelectNamed: 'Select {option}',
  optionSentNotConfirmed: 'Sent to the agent — not confirmed',
  optionValueIsDefault: 'Default',
  optionValueNotReported: 'Not reported',
  optionToggle: 'Toggle {option}',
  optionChooseInAgentPicker: 'Choose in agent picker…',

  // Send failures shown in the composer banner
  sendMessageNotSent: 'Message not sent',
  sendMessageNotSentDisconnected: 'Message not sent (disconnected)',
  sendDeliveryUnconfirmed: 'Delivery unconfirmed — check chat before retrying',
  sendAnswerNotSent: 'Answer not sent',
  sendAnswerNotSentDisconnected: 'Answer not sent (disconnected)',
  sendAnswerNotSentCheckChat: 'Answer not sent — check chat before retrying',
  sendAnswerUnconfirmed: 'Answer unconfirmed — check chat before retrying',
  sendResponseNotSent: 'Response not sent',
  sendResponseNotSentDisconnected: 'Response not sent (disconnected)',
  sendResponseUnconfirmed: 'Response unconfirmed — check chat before retrying',
  sendCancelNotSent: 'Cancel not sent',
  sendCancelNotSentDisconnected: 'Cancel not sent (disconnected)',
  sendCancelUnconfirmed: 'Cancel unconfirmed — check chat before retrying',
  sendStopNotSent: 'Stop not sent',
  sendStopNotSentTerminalNotReady: 'Stop not sent (terminal not ready)',
  sendStopUnconfirmed: 'Stop unconfirmed — check chat before retrying',

  // Structured sessions
  commandWaitForPendingWork: 'Wait for pending work to finish before using this command.',
  commandOperationUnconfirmed:
    'Conversation operation is unconfirmed; retry checks the same operation.',
  transcriptStreamFailed: 'Transcript stream failed',
  launchUnconfirmed: 'The {agent} chat result could not be confirmed.',
  launchFailed: 'Could not open {agent} chat.',
  commandRemoveAttachments: 'Remove attachments before using a chat-session command.',

  // View toggle
  toggleToTerminalView: 'Switch to terminal view',
  toggleToChatView: 'Switch to chat view',
  composerReconnecting: 'Reconnecting…',
  composerWaitingForTerminal: 'Waiting for terminal…',
  askStep: 'Step {step}',
  sendAnswerPartlySent: 'Answer partly sent — check chat before retrying',
  agentWorking: 'Agent is working'
} as const satisfies MobileCatalogSource
