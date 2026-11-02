# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# The /v1/public and /v1/console proxy destinations are resolved by rewrites()
# during `next build` and written into .next/routes-manifest.json, so this must
# be a build arg. Passing it only in `environment:` leaves the image proxying to
# localhost:4000 — which, inside this container, is this server. Keep it in step
# with the `environment:` value in docker-compose.yml.
ARG QWENCH_API_URL="http://backend:4000"
ENV QWENCH_API_URL=$QWENCH_API_URL

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# have to arrive as build args too — setting them in `environment:` at run time
# does nothing. Both are optional: an empty value hides that channel's button
# rather than rendering a dead link.
ARG NEXT_PUBLIC_WHATSAPP_NUMBER=""
ARG NEXT_PUBLIC_TELEGRAM_USERNAME=""
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_TELEGRAM_USERNAME=$NEXT_PUBLIC_TELEGRAM_USERNAME

# No backend is reachable here, and that is fine: every page that shows API data
# waits for a real request (see src/components/home/StatsRow.tsx), so nothing
# built here can bake in a "couldn't reach Qwench" answer about a real company.
RUN npm run build

# Stage 3: Production runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER node

# Copy build artifacts and dependencies
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["npm", "start"]

