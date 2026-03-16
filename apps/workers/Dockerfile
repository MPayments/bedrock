# -----------------------------------------------------------
# apps/workers — Background job runners
# Build from repo root: docker build -f apps/workers/Dockerfile .
# -----------------------------------------------------------

FROM node:24-slim AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# --- Prune monorepo to only workers and its dependencies ---
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune workers --docker --out-dir out

# --- Install dependencies ---
FROM oven/bun:1.3.6-slim AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/patches/ ./patches/
RUN bun install --frozen-lockfile

# --- Runner ---
FROM base AS runner

RUN groupadd --gid 1001 bedrock && \
    useradd --uid 1001 --gid bedrock --shell /bin/sh --create-home bedrock

WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./

USER bedrock

EXPOSE 8081

# Default: all workers. Override: ["node","--import=tsx","apps/workers/src/main.ts","ledger"]
CMD ["node", "--import=tsx", "apps/workers/src/main.ts", "all"]
