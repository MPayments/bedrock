# -----------------------------------------------------------
# apps/finance — Next.js frontend (standalone output)
# Build from repo root: docker build -f apps/finance/Dockerfile .
# -----------------------------------------------------------

ARG API_INTERNAL_URL

FROM node:24-slim AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# --- Prune monorepo to only finance and its dependencies ---
# finance → sdk-api-client → api, so api is included transitively
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune finance --docker --out-dir out
RUN mkdir -p out/full/apps/finance/public && \
    if [ -d apps/finance/public ]; then \
      cp -a apps/finance/public out/full/apps/finance/public; \
    fi

# --- Install dependencies ---
FROM oven/bun:1.3.6-slim AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/patches/ ./patches/
RUN bun install --frozen-lockfile

# --- Build ---
FROM base AS builder
ARG NEXT_BUILD_MAX_OLD_SPACE_SIZE=4096
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=${NEXT_BUILD_MAX_OLD_SPACE_SIZE}

COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./

# Build shared API artifacts first so finance consumes compiled RPC client types.
WORKDIR /repo/apps/api
RUN node build.mjs

WORKDIR /repo
RUN node_modules/.bin/tsc -p packages/sdk/api-client/tsconfig.build.json

# Build Next.js (produces .next/standalone)
ARG API_INTERNAL_URL=http://localhost:3000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN node apps/finance/node_modules/.bin/next build apps/finance

# --- Runner ---
FROM node:24-slim AS runner

RUN groupadd --gid 1001 bedrock && \
    useradd --uid 1001 --gid bedrock --shell /bin/sh --create-home bedrock

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=bedrock:bedrock /repo/apps/finance/.next/standalone ./
COPY --from=builder --chown=bedrock:bedrock /repo/apps/finance/.next/static ./apps/finance/.next/static
COPY --from=builder --chown=bedrock:bedrock /repo/apps/finance/public ./apps/finance/public

USER bedrock

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "apps/finance/server.js"]
