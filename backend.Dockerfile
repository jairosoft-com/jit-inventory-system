# Build context for this file MUST be the repo root (where package.json,
# prisma/, apps/, and packages/ all live) — not apps/backend.
# In docker-compose.yml: build.context: .

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package.json files for every workspace so `npm ci` can resolve the
# workspace tree correctly (npm workspaces needs all of them present).
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY prisma ./prisma
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=backend

# NOTE: we intentionally do NOT run `npm prune --omit=dev` here. In npm
# workspaces, prune has a known bug where it can strip out production
# dependencies (like express itself) from the hoisted node_modules tree.
# Shipping devDependencies in the image costs some size, but for an
# internal single-host deployment that's a fine tradeoff for reliability.

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
# npm workspaces nests any dependency that conflicts with a root-level
# version instead of hoisting it — express, body-parser, dotenv, prisma,
# node-cron, and others all end up here rather than in root node_modules.
# Without this, Node's module resolution can't find them at runtime.
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

EXPOSE 3001

# Apply pending migrations, then start the server.
# WORKDIR is /app, so index.ts's dotenv lookup (process.cwd()/.env) simply
# won't find a file — that's fine, env vars come from docker-compose instead.
CMD npx prisma migrate deploy --schema=prisma/schema.prisma && node apps/backend/dist/index.js
