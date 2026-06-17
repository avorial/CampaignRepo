# syntax=docker/dockerfile:1

# --- Builder: install deps (incl. native better-sqlite3) and build standalone ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Toolchain in case better-sqlite3 compiles from source (no prebuilt for the arch).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runner: minimal image running the Next standalone server ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Set SECURE_COOKIES=true when serving behind HTTPS.

# Standalone output bundles a minimal node_modules (including better-sqlite3).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# SQLite data lives here; mount a volume to persist accounts/sessions/index.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "server.js"]
