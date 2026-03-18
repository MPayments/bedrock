# -----------------------------------------------------------
# apps/api — Hono API server
# Build from repo root: docker build -f apps/api/Dockerfile .
# -----------------------------------------------------------

FROM node:24-slim AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# --- Prune monorepo to only api and its dependencies ---
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune api --docker --out-dir out

# --- Install dependencies ---
FROM oven/bun:1.3.6-slim AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/patches/ ./patches/
RUN bun install --frozen-lockfile

# --- Bundle with esbuild ---
FROM base AS builder
WORKDIR /repo
COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./
RUN cd apps/api && node build.mjs

# --- Runner ---
FROM base AS runner

RUN groupadd --gid 1001 bedrock && \
    useradd --uid 1001 --gid bedrock --shell /bin/sh --create-home bedrock

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/ ./

USER bedrock

EXPOSE 3002

CMD ["node", "apps/api/dist/server.mjs"]
