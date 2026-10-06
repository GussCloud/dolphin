# Build context: cloud/ (docker build -f apps/auth/Dockerfile .)
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/auth/package.json apps/auth/package.json
RUN pnpm install --frozen-lockfile --filter @dolphin-cloud/auth...
COPY apps/auth apps/auth
RUN pnpm --filter @dolphin-cloud/auth build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV DOLPHIN_AUTH_DATA_DIR=/data
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/auth/package.json apps/auth/package.json
COPY --from=build /app/apps/auth/dist apps/auth/dist
# Browser scripts for the work view; read at startup from ../static relative to dist/.
COPY apps/auth/static apps/auth/static
RUN pnpm install --prod --frozen-lockfile --filter @dolphin-cloud/auth... \
  && mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "--disable-warning=ExperimentalWarning", "apps/auth/dist/index.js"]
