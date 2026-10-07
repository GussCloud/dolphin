// Mobile port of desktop's pill labeling
// (src/renderer/src/components/native-chat/native-chat-session-option-labels.ts),
// translated through the `session-chat` catalog with the desktop's wording.

import type {
  SessionOptionDescriptor,
  SessionOptionDisabledReason,
  SessionOptionSelectChoice
} from '../../../src/shared/native-chat-session-options'
import { sessionChatCatalog } from '../i18n/catalogs/session-chat'
import { translate } from '../i18n/mobile-locale-state'

export function mobileSessionOptionLabel(descriptor: SessionOptionDescriptor): string {
  switch (descriptor.id) {
    case 'model':
      return translate(sessionChatCatalog, 'optionModel')
    case 'effort':
      return translate(sessionChatCatalog, 'optionEffort')
    case 'fastMode':
      return translate(sessionChatCatalog, 'optionFastMode')
    case 'thinking':
      return translate(sessionChatCatalog, 'optionThinking')
    default:
      return descriptor.label
  }
}

export function mobileSessionChoiceLabel(choice: SessionOptionSelectChoice): string {
  switch (choice.value) {
    case 'minimal':
      return translate(sessionChatCatalog, 'optionValueMinimal')
    case 'low':
      return translate(sessionChatCatalog, 'optionValueLow')
    case 'medium':
      return translate(sessionChatCatalog, 'optionValueMedium')
    case 'high':
      return translate(sessionChatCatalog, 'optionValueHigh')
    case 'xhigh':
      return translate(sessionChatCatalog, 'optionValueXhigh')
    case 'max':
      return translate(sessionChatCatalog, 'optionValueMax')
    case 'ultra':
      return translate(sessionChatCatalog, 'optionValueUltra')
    default:
      return choice.label
  }
}

export function mobileSessionOptionDisabledReason(
  reason: SessionOptionDisabledReason | undefined
): string | null {
  // Exhaustive over SessionOptionDisabledReason so new keys are a compile error.
  switch (reason) {
    case 'set-when-session-starts':
      return translate(sessionChatCatalog, 'optionSetWhenSessionStarts')
    case 'available-after-session-start':
      return translate(sessionChatCatalog, 'optionAvailableAfterSessionStarts')
    case undefined:
      return null
  }
}

function selectedChoiceLabel(descriptor: SessionOptionDescriptor): string | null {
  if (
    descriptor.valueSource === 'unknown' ||
    descriptor.kind.type !== 'select' ||
    !descriptor.kind.currentValue
  ) {
    return null
  }
  const current = descriptor.kind.currentValue
  const choice: SessionOptionSelectChoice = descriptor.kind.choices.find(
    (candidate) => candidate.value === current
  ) ?? { value: current, label: current }
  return mobileSessionChoiceLabel(choice)
}

/** Value-only pill text — the category lives on the sheet title, not the pill. */
export function mobileModelPillLabel(descriptor: SessionOptionDescriptor): string {
  return selectedChoiceLabel(descriptor) ?? translate(sessionChatCatalog, 'optionModel')
}

export function mobileSessionOptionSummaryValue(descriptor: SessionOptionDescriptor): string {
  // A boolean always has a value, so the summary states it and lets the sheet's
  // marker say whether anything confirmed it. Reading "Not set" here while the
  // sheet showed the switch on made the two screens disagree.
  if (descriptor.kind.type === 'boolean') {
    return descriptor.kind.currentValue
      ? translate(sessionChatCatalog, 'optionOn')
      : translate(sessionChatCatalog, 'optionOff')
  }
  if (descriptor.valueSource === 'unknown') {
    return translate(sessionChatCatalog, 'optionNotSet')
  }
  return selectedChoiceLabel(descriptor) ?? translate(sessionChatCatalog, 'optionNotSet')
}

export function mobileOptionsPillLabel(descriptors: readonly SessionOptionDescriptor[]): string {
  const labels: string[] = []
  for (const descriptor of descriptors) {
    if (descriptor.valueSource === 'unknown') {
      continue
    }
    if (descriptor.kind.type === 'select') {
      const label = selectedChoiceLabel(descriptor)
      if (label) {
        labels.push(label)
      }
    } else if (descriptor.kind.currentValue === true) {
      labels.push(
        descriptor.id === 'fastMode'
          ? translate(sessionChatCatalog, 'optionValueFast')
          : mobileSessionOptionLabel(descriptor)
      )
    }
  }
  if (labels.length > 0) {
    return labels.join(' · ')
  }
  const effort = descriptors.find((descriptor) => descriptor.id === 'effort')
  return effort ? mobileSessionOptionLabel(effort) : translate(sessionChatCatalog, 'optionOptions')
}
