/** ps spells "no controlling terminal" `?` on Linux, `??` on macOS, and `-` / `0` on some builds. */
export function hasControllingTty(tty: string | undefined): tty is string {
  return (
    typeof tty === 'string' &&
    tty !== '' &&
    tty !== '?' &&
    tty !== '??' &&
    tty !== '-' &&
    tty !== '0' &&
    !/^0,\d+$/.test(tty)
  )
}
