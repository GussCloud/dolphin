import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const appRoutesEn = {
  back: 'Back',
  cancel: 'Cancel',
  continue: 'Continue',
  openSettings: 'Open Settings',
  tryAgain: 'Try Again',
  backToHome: 'Back to home',

  // Pairing
  missingPairingCode: 'Missing pairing code',
  pairConfirmTitle: 'Pair with this desktop?',
  pairConfirmSubtitle:
    'You opened a pairing link from your desktop. Confirm to add it to your hosts.',
  pair: 'Pair',
  connecting: 'Connecting…',
  pairingLog: 'Pairing log',
  pairingTimedOut: "Couldn't connect within {seconds}s — see log below for where it stalled",
  pairingFailed: 'Pairing failed: {reason}',
  invalidQrCode: 'Not a valid Dolphin QR code',
  invalidPairingCode: 'Not a valid pairing code — copy it from your computer and paste again',
  pairWithDesktop: 'Pair with desktop',
  cameraAccessDisabled: 'Camera Access Disabled',
  scanPrompt: 'Scan the QR code from Dolphin on your desktop, or paste the pairing code instead.',
  cameraDisabledPrompt: 'Enable camera access in Settings, or paste the pairing code instead.',
  pasteCodeInstead: 'Paste code instead',
  orPasteCode: 'Or paste pairing code',
  pasteCodeTitle: 'Paste pairing code',
  pasteCodeMessage: 'Copy the code shown under the QR on your computer.',
  pasteCodePlaceholder: 'dolphin://pair?code=... or paste the code',
  scanStepOpenDolphin: 'Open Dolphin on your computer',
  scanStepOpenMobileSettings: 'Go to Settings → Mobile',
  scanStepScan: 'Scan the QR code',

  // Onboarding
  onboardingSaveChoiceError: 'Your choice could not be saved. Try again.',
  onboardingNotificationsError: 'Notification settings could not be updated. Try again.',
  onboardingProgress: 'Onboarding progress',
  onboardingStep: 'Step {current} of {total}'
} as const satisfies MobileCatalogSource
