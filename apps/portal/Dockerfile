# syntax=docker/dockerfile:1-labs

ARG APP=portal
ARG APP_DIR=apps/portal
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_CRM_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET

FROM node:22-slim AS base
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

FROM base AS builder
ARG APP
ARG APP_DIR
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_CRM_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_APP_DESCRIPTION
ARG BETTER_AUTH_URL
ARG BETTER_AUTH_SECRET
WORKDIR /repo/out
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_PUBLIC_CRM_URL=$NEXT_PUBLIC_CRM_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_TITLE=$NEXT_PUBLIC_APP_TITLE
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
COPY --from=pruner /repo/out/json/ ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm ci
COPY --from=pruner /repo/out/full/ ./
RUN npx turbo@^2 run build --filter=${APP}...
RUN npm prune --omit=dev || true

FROM node:22-slim AS runner
ARG APP_DIR
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ENV APP_DIR=${APP_DIR}
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/out/${APP_DIR}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/out/${APP_DIR}/.next/static     ./${APP_DIR}/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/out/${APP_DIR}/public           ./${APP_DIR}/public

COPY --from=builder --chown=nextjs:nodejs /repo/out/packages                ./packages

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh","-lc","node ${APP_DIR}/server.js"]
