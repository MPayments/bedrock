# -----------------------------------------------------------
# apps/web — Next.js frontend (standalone output)
# Build from repo root: docker build -f apps/web/Dockerfile .
# -----------------------------------------------------------

FROM node:24-slim AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

# --- Prune monorepo to only web and its dependencies ---
# web → sdk-api-client → api, so api is included transitively
FROM base AS pruner
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune web --docker --out-dir out
RUN mkdir -p out/full/apps/web/public && \
    if [ -d apps/web/public ]; then \
      cp -a apps/web/public out/full/apps/web/public; \
    fi

# --- Install dependencies ---
FROM oven/bun:1.3.6-slim AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/patches/ ./patches/
RUN bun install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=installer /repo/ ./
COPY --from=pruner /repo/out/full/ ./

# Build API types first (web imports types from api/dist via sdk-api-client)
RUN npx tsgo --project apps/api/tsconfig.json

# Build Next.js (produces .next/standalone)
ARG BEDROCK_INTERNAL_API_URL=http://localhost:3002
ENV BEDROCK_INTERNAL_API_URL=${BEDROCK_INTERNAL_API_URL}
RUN node apps/web/node_modules/.bin/next build apps/web

# --- Runner ---
FROM node:24-slim AS runner

RUN groupadd --gid 1001 bedrock && \
    useradd --uid 1001 --gid bedrock --shell /bin/sh --create-home bedrock

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=bedrock:bedrock /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=bedrock:bedrock /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=bedrock:bedrock /repo/apps/web/public ./apps/web/public

USER bedrock

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
