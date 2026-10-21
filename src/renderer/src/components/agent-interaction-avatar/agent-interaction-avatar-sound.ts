import type { AgentInteractionKind } from '../../../../shared/agent-interaction-settings'

let playing: { audio: HTMLAudioElement; url: string } | null = null

function stopPlaying(): void {
  if (!playing) {
    return
  }
  playing.audio.pause()
  URL.revokeObjectURL(playing.url)
  playing = null
}

/** Plays the event's sound once; a newer cue cuts off the previous one instead of overlapping. */
export async function playAgentInteractionSound(
  kind: AgentInteractionKind,
  volume: number
): Promise<void> {
  const sound = await window.api.agentInteractionAvatar.loadSound(kind)
  if (!sound.ok) {
    if (sound.reason !== 'silent' && sound.reason !== 'disabled') {
      console.warn('[agent-interaction] sound unavailable:', sound.reason)
    }
    return
  }
  stopPlaying()
  const bytes = new Uint8Array(sound.data.byteLength)
  bytes.set(sound.data)
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: sound.mimeType }))
  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, volume / 100))
  const current = { audio, url }
  playing = current
  audio.addEventListener('ended', () => {
    if (playing === current) {
      stopPlaying()
    }
  })
  try {
    await audio.play()
  } catch (error) {
    console.warn('[agent-interaction] sound playback failed:', error)
  }
}
