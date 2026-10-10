export const LOCAL_SPEECH_UNSUPPORTED_ERROR = 'local_speech_unsupported'

// Why: sherpa-onnx publishes no win-arm64 addon, and an x64 .node cannot load into an arm64 process.
export function isLocalSpeechRuntimeSupported(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): boolean {
  return !(platform === 'win32' && arch === 'arm64')
}
