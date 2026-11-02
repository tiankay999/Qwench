# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install build tools for native modules (bcrypt) and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm matching package.json packageManager
RUN npm install -g pnpm@12.16.1

# Stage 1: Install production dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Final lightweight production image
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000
ENV API_PORT=4000

# Run as non-root node user
USER node

# Copy production node_modules and application code
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "src/server.js"]

