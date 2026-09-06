# syntax=docker/dockerfile:1

# Multi-stage build for the NestJS API. Build context must be the repo root
# (docker-compose.yml sets `context: .`) since this is a pnpm workspace and
# the API depends on the sibling `packages/shared` workspace package.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# --- deps: install once, cached across builds as long as lockfiles don't change ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @url-shortener/api... 

# --- build: compile shared package + API ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @url-shortener/shared build \
 && pnpm --filter @url-shortener/api build

# --- runtime: slim image, only what's needed to run + migrate ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=deps /app/packages/shared/package.json packages/shared/package.json
COPY --from=deps /app/apps/api/package.json apps/api/package.json
# Production deps only, but keep drizzle-kit (a devDependency) since the
# entrypoint runs migrations with it before the server starts - simplest way
# to guarantee the schema is current on every deploy without a separate
# migration image.
RUN pnpm install --frozen-lockfile --filter @url-shortener/api... \
 && pnpm add --filter @url-shortener/api -D drizzle-kit@^0.31.10

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/drizzle.config.ts apps/api/drizzle.config.ts
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
