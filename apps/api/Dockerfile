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
# Copy patched dist files out of bun's symlink tree so runner stage can COPY them
RUN mkdir -p /patches-resolved && \
    cp node_modules/.bun/tlsclientwrapper@4.1.2/node_modules/tlsclientwrapper/dist/index.mjs /patches-resolved/tlsclientwrapper-index.mjs && \
    cp node_modules/.bun/tlsclientwrapper@4.1.2/node_modules/tlsclientwrapper/dist/index.cjs /patches-resolved/tlsclientwrapper-index.cjs

# --- Bundle with esbuild ---
FROM base AS builder
WORKDIR /repo
COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./
RUN cd apps/api && node build.mjs

# --- Runner ---
FROM base AS runner

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 1001 bedrock && \
    useradd --uid 1001 --gid bedrock --shell /bin/sh --create-home bedrock

WORKDIR /app
ENV NODE_ENV=production

# Copy only the esbuild bundle
COPY --from=builder /repo/apps/api/dist/server.mjs ./server.mjs

# Install native/unbundleable external dependencies
RUN npm install --no-save tigerbeetle-node tlsclientwrapper

# Apply bun patch for tlsclientwrapper (npm install does not apply bun patches,
# patch fixes corrupted-download detection and atomic file writes)
COPY --from=installer /patches-resolved/tlsclientwrapper-index.mjs ./node_modules/tlsclientwrapper/dist/index.mjs
COPY --from=installer /patches-resolved/tlsclientwrapper-index.cjs ./node_modules/tlsclientwrapper/dist/index.cjs

# Pre-download TLS client binary during build so runtime doesn't need GitHub access
RUN node -e "const {ModuleClient}=require('tlsclientwrapper');const m=new ModuleClient();m.open().then(()=>m.terminate()).catch(e=>{console.error(e);process.exit(1)})"

USER bedrock

EXPOSE 3002

CMD ["node", "server.mjs"]
