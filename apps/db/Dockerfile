# -----------------------------------------------------------
# apps/db — Database migrations and seeds (init container / job)
# Build from repo root: docker build -f apps/db/Dockerfile .
# -----------------------------------------------------------

FROM node:24-slim AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# --- Prune monorepo to only db and its dependencies ---
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune db --docker --out-dir out

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

WORKDIR /app/apps/db

# Default: run migrations.
# Override for seeds: ["node", "--import=tsx", "src/seeds/run-all.ts"]
# Override for nuke:  ["node", "--import=tsx", "src/nuke.ts"]
CMD ["node", "--import=tsx", "node_modules/.bin/drizzle-kit", "migrate", "--config", "drizzle.config.ts"]
