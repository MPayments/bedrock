# syntax=docker/dockerfile:1-labs

ARG APP=crm
ARG APP_DIR=apps/crm
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET

FROM node:24-slim AS base
ENV NODE_ENV=production npm_config_loglevel=warn TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS pruner
ARG APP
ARG APP_DIR
RUN npm i -g turbo@^2
COPY turbo.json package.json bun.lock ./
COPY --parents apps/*/package.json packages/*/package.json ./
COPY . .
RUN turbo prune ${APP} --docker --out-dir out
RUN mkdir -p out/full/${APP_DIR} && \
    if [ -d ${APP_DIR}/public ]; then \
      cp -a ${APP_DIR}/public out/full/${APP_DIR}/public; \
    else \
      mkdir -p out/full/${APP_DIR}/public; \
    fi

FROM oven/bun:1.3.6-slim AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/patches/ ./patches/
RUN bun install --frozen-lockfile

FROM base AS builder
ARG APP
ARG APP_DIR
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_TITLE=$NEXT_PUBLIC_APP_TITLE
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./
RUN node ${APP_DIR}/node_modules/.bin/next build ${APP_DIR}

FROM node:24-slim AS runner
ARG APP_DIR
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ENV APP_DIR=${APP_DIR}
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/${APP_DIR}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/${APP_DIR}/.next/static     ./${APP_DIR}/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/${APP_DIR}/public           ./${APP_DIR}/public

COPY --from=builder --chown=nextjs:nodejs /repo/packages                    ./packages

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh","-lc","node ${APP_DIR}/server.js"]
