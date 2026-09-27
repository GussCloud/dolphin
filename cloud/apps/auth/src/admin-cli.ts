import { randomUUID } from 'node:crypto'
import { readAuthConfig } from './config.js'
import { hashPassword } from './secrets.js'
import { AuthStore } from './store.js'

// Usage (inside the container):
//   node apps/auth/dist/admin-cli.js create-user <email> [display name]   (password from DOLPHIN_PASSWORD)
//   node apps/auth/dist/admin-cli.js set-password <email>                  (password from DOLPHIN_PASSWORD)
//   node apps/auth/dist/admin-cli.js list-users
const [command, email, ...nameParts] = process.argv.slice(2)
const store = new AuthStore(readAuthConfig().dataDir)

function requirePassword(): string {
  const password = process.env.DOLPHIN_PASSWORD ?? ''
  if (password.length < 12) {
    console.error('Set DOLPHIN_PASSWORD to at least 12 characters.')
    process.exit(2)
  }
  return password
}

if (command === 'create-user' && email) {
  store.createUser({
    id: `usr_${randomUUID().replaceAll('-', '')}`,
    email,
    passwordHash: await hashPassword(requirePassword()),
    ...(nameParts.length > 0 ? { displayName: nameParts.join(' ') } : {})
  })
  console.log(`Created ${email}`)
} else if (command === 'set-password' && email) {
  const updated = store.setPassword(email, await hashPassword(requirePassword()))
  console.log(updated ? `Updated ${email}` : `No user ${email}`)
  process.exit(updated ? 0 : 1)
} else if (command === 'list-users') {
  console.table(store.listUsers())
} else {
  console.error('Usage: admin-cli.js create-user <email> [name] | set-password <email> | list-users')
  process.exit(2)
}
