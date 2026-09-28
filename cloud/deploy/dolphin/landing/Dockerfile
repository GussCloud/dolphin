# Caddy with the marketing site (docs/landing-site) baked in; the app feeds stay bind-mounted.
# Build context: docs/landing-site (the compose `landing` service context).
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm --ignore-workspace install --frozen-lockfile
COPY . .
RUN pnpm --ignore-workspace build

FROM caddy:2
COPY --from=build /app/out /srv/site
