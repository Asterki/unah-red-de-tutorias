# syntax=docker/dockerfile:1.7

# Headless production image. The build context is the repository root.
FROM node:25-alpine AS base
RUN apk add --no-cache tini
WORKDIR /app

# ---------------------------------------------------------------------------
# Shared package: built once and copied into the server stages. The server
# bundle inlines it, so it is not present in the runtime image.
# ---------------------------------------------------------------------------
FROM base AS shared-build
WORKDIR /app/shared
COPY shared/package.json shared/package-lock.json ./
RUN npm ci
COPY shared/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Server build: generate the Prisma client and bundle the server (shared
# inlined) plus the seed CLI.
# ---------------------------------------------------------------------------
FROM base AS server-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
COPY --from=shared-build /app/shared/package.json /app/shared/package.json
COPY --from=shared-build /app/shared/dist /app/shared/dist
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# Production dependencies only. `prisma` is a runtime dependency because the
# migrate job reuses this image; that is smaller and more reliable than
# copying the CLI and its transitive dependencies from the builder.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
COPY --from=shared-build /app/shared/package.json /app/shared/package.json
COPY --from=shared-build /app/shared/dist /app/shared/dist
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Runtime: no client build, no dev dependencies, no source tree.
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/prisma ./prisma
COPY --from=server-build /app/server/prisma.config.ts ./prisma.config.ts
COPY server/package.json ./package.json
COPY docs/in-app ./docs/in-app

# npm is a build-time tool. Removing it drops its bundled dependencies from the
# runtime attack surface; the image starts and migrates with node and
# node_modules/.bin/prisma only.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
