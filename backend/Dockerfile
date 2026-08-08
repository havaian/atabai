# syntax=docker/dockerfile:1.6

# Three-stage build:
#   1. prod-deps - installs ONLY production deps (fast, parallel with builder)
#   2. builder   - installs all deps + runs the TS build
#   3. runner    - copies prod-deps' node_modules + builder's dist
#
# This avoids the 17-minute `npm prune --production` step the previous
# Dockerfile had, which was 90% of the build wall-time. BuildKit runs stages
# 1 and 2 in parallel, so total time is bounded by whichever finishes last.

ARG NODE_IMAGE=node:24-alpine

# ─── Stage 1: production dependencies only ────────────────────────────────────
FROM ${NODE_IMAGE} AS prod-deps

WORKDIR /app

COPY package*.json ./

# --omit=dev  - skip devDependencies entirely (no typescript, no @nestjs/cli, etc.)
# --no-audit  - skip the npm security audit (this was the bulk of the prune
#               time; run `npm audit` out-of-band in CI if you want it)
# --no-fund   - silence the "consider funding" footer
RUN npm ci --omit=dev --no-audit --no-fund


# ─── Stage 2: full deps + TypeScript build ────────────────────────────────────
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Full install - includes typescript, @nestjs/cli, type packages, etc. so the
# build step has everything it needs. These deps NEVER reach the runner image.
RUN npm ci --no-audit --no-fund

# Source. Express-era top-level `templates/` is gone; templates HTTP module is
# at src/templates/ (copied with src), and seed JSON is under
# src/admin/seedLocales/ + src/mappings/ (also copied with src).
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# `npm run build` runs `tsc -p tsconfig.build.json && node ./scripts/copy-assets.mjs`
# - emits dist/ + copies seed JSON. No `npm prune` here (that's the 17-min step).
RUN npm run build


# ─── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist          ./dist
COPY --from=builder   /app/package.json  ./package.json
COPY --from=builder   /app/public        ./public

EXPOSE 3000

CMD ["node", "dist/main.js"]
