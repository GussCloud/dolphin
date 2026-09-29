# Dolphin self-hosted services

One VPS runs everything the Dolphin desktop app reaches:

| Host | Service | What uses it |
|---|---|---|
| `dolphin.guss.dev.br` | Static site (Caddy) | Marketing site (built from `docs/landing-site` into the Caddy image), docs links, update changelog/nudge feeds, plugin kill-list |
| `auth.dolphin.guss.dev.br` | `apps/auth` | Cloud sign-in, relay host tokens, JWKS the relay trusts |
| `api.dolphin.guss.dev.br` | `apps/auth` (`/v1/feedback`) | Feedback and crash reports |
| `relay.dolphin.guss.dev.br` | `apps/relay` (combined director + cell) | Pairing the mobile app with the desktop over the internet |
| `push.dolphin.guss.dev.br` | `apps/push` | Android push notifications through FCM (Firebase project `dolphin-cloud-cf4ca`) |

Not deployed yet:

- **iOS push**. The push service runs without an APNs key, so only Android receives notifications.
- **Sharing** (`share.`). There is no server source for artifact and skill sharing.

## Prerequisites

- A VPS with Docker and the compose plugin, with ports 80 and 443 open.
- DNS `A`/`AAAA` records for the hosts above, pointing at the VPS. Caddy obtains the certificates.
- `firebase-sa.json` beside `docker-compose.yml`: a service-account key from the Firebase console (Project settings → Service accounts → Generate new private key), readable by the container's `node` user:

  ```bash
  sudo install -m 600 -o 1000 -g 1000 /dev/null firebase-sa.json && sudo nano firebase-sa.json
  ```

  It is gitignored. The app side of the same project is `mobile/google-services.json`.

## Deploy

```bash
git clone https://github.com/GussCloud/dolphin.git && cd dolphin/cloud/deploy/dolphin
cp .env.example .env
# Set ACME_EMAIL and RELAY_ASSIGNMENT_SIGNING_KEY (openssl rand -base64 48)
docker compose up -d --build
```

## Create your account

Sign-up is closed; accounts are created on the server:

```bash
docker compose exec -e DOLPHIN_PASSWORD='a long password' auth \
  node --disable-warning=ExperimentalWarning apps/auth/dist/admin-cli.js create-user you@example.com "Your Name"
docker compose exec auth node --disable-warning=ExperimentalWarning apps/auth/dist/admin-cli.js list-users
```

Then in Dolphin, sign in to the cloud account from Settings. A browser page on `auth.` asks for that email and password, and returns to the app. After that, remote mobile pairing is available.

## Check

```bash
curl https://auth.dolphin.guss.dev.br/healthz
curl https://auth.dolphin.guss.dev.br/.well-known/jwks.json
curl https://relay.dolphin.guss.dev.br/ready     # the relay fetches the JWKS above
curl https://push.dolphin.guss.dev.br/health
```

## Data and keys

- `auth-data` volume: `dolphin-auth.sqlite` (users, sessions, feedback) and `relay-signing-key.pem`. The ES256 key is generated on first boot. **Back up this volume.** Losing the key only invalidates relay tokens, which are reissued on the next refresh.
- `relay-data` volume: the relay's SQLite state.
- `push-data` volume: registered phones and pending deliveries (SQLite). Losing it only means phones re-register.
- To read feedback, copy the database out: `docker compose cp auth:/data/dolphin-auth.sqlite .` and open it with any SQLite client (table `feedback`).

## Update

```bash
git pull && docker compose up -d --build
```
