# Build context for this file MUST be the repo root, same reasoning as
# backend.Dockerfile — npm workspaces needs the full workspace tree.

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared

# Baked in at build time. Since nginx proxies /api on the same origin
# (see nginx.conf), a relative path works and needs no IP hardcoded.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=frontend

# --- Runtime stage ---
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
