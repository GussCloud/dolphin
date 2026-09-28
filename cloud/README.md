# Dolphin Cloud

The servers the Dolphin apps talk to: sign-in, the relay that connects the
mobile app to a desktop host, and the mobile push gateway. Phones and desktops
never talk to each other directly: each opens an outbound WebSocket to the
relay, which pairs the two sessions and splices frames between them.

This directory is an independent pnpm workspace inside the Dolphin monorepo. Run
its commands from `cloud/`, not the repository root. The source is covered by
the repository's root [MIT license](../LICENSE).

## Packages

- `apps/auth`: cloud sign-in for the desktop app, the relay host tokens, the
  JWKS the relay trusts, and the feedback endpoint.
- `apps/relay` and `packages/relay-contract`: the relay server and the wire
  contract it shares with the desktop and mobile apps (frame shapes, close
  codes, admission budgets, splice state machine). The same image runs as a
  director, a cell, or both in one process, depending on `DOLPHIN_RELAY_ROLE`.
- `apps/push` and `packages/push-contract`: the mobile push gateway and its wire
  contract. The desktop host authenticates with the same X25519 key it uses for
  the relay, registers each paired phone's native push token, and asks the
  gateway to send through APNs and FCM. Logging is aggregate counters only.
- `packages/postgres-schema`: the shared PostgreSQL schema tooling.

Storage is PostgreSQL in production and SQLite for tests and local development.

## Deploying

[`deploy/dolphin`](deploy/dolphin/README.md) runs `auth` and `relay` behind Caddy
on a single VPS with Docker Compose. `Cloud Verify` builds, typechecks, lints,
tests and secret-scans this directory on every change under `cloud/`.

## Local development

```sh
cd cloud
pnpm install
pnpm build
pnpm test
```

`pnpm test` runs the SQLite-backed suites. Tests that need PostgreSQL run only
when `DOLPHIN_RELAY_TEST_POSTGRES_URL` points at a disposable PostgreSQL 16 or 17
database, for example:

```sh
docker run --rm -d --name dolphin-relay-pg -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=dolphin_relay_test -p 55440:5432 postgres:16-alpine
DOLPHIN_RELAY_TEST_POSTGRES_URL=postgres://postgres@127.0.0.1:55440/dolphin_relay_test \
  pnpm --filter @dolphin-cloud/relay test
docker rm -f dolphin-relay-pg
```

Configuration is read from environment variables validated in
`apps/relay/src/config.ts`. `DOLPHIN_RELAY_ASSIGNMENT_SIGNING_KEY` (at least 32
bytes) is the only required value; everything else has a local default.
