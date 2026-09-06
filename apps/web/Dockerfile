# syntax=docker/dockerfile:1

# Multi-stage build for the React app: build the static bundle with Vite,
# serve it with nginx as a plain static file server. Reverse-proxying to
# the API is Traefik's job (see docker-compose.yml's `traefik` service and
# this service's own labels), not nginx's - this container only serves
# the built assets with SPA fallback.

FROM node:26-slim AS base
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @url-shortener/web...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @url-shortener/shared build \
 && pnpm --filter @url-shortener/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
