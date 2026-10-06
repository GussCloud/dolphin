import { randomUUID } from 'node:crypto'
import { readAuthConfig } from './config.js'
import { hashPassword, randomToken } from './secrets.js'
import { AuthStore } from './store.js'

// Usage (inside the container):
//   node apps/auth/dist/admin-cli.js create-user <email> [display name]   (password from DOLPHIN_PASSWORD)
//   node apps/auth/dist/admin-cli.js set-password <email>                  (password from DOLPHIN_PASSWORD)
//   node apps/auth/dist/admin-cli.js list-users                            (azure_devops: yes = signs in with Azure DevOps)
//   node apps/auth/dist/admin-cli.js create-invite                         (prints a single-use console invite)
//   node apps/auth/dist/admin-cli.js list-orgs
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
} else if (command === 'create-invite') {
  // Only the hash is stored, so this is the one time the code can be read.
  const code = randomToken('inv')
  store.organizations.insertInvite(code, Date.now())
  console.log(code)
} else if (command === 'list-orgs') {
  console.table(store.organizations.listOrganizations())
} else {
  console.error(
    'Usage: admin-cli.js create-user <email> [name] | set-password <email> | list-users | create-invite | list-orgs'
  )
  process.exit(2)
}
