// Why re-export rather than redefine: POSIX single-quote escaping had four
// byte-identical copies in this tree. One of them is enough.
import { quotePosixShell } from '../shared/wsl-login-shell-command'

export { quotePosixShell as quoteBashString }
