# ============================================================
# FuelRipple API — Multi-stage Docker build
# Builds the Turborepo monorepo, then copies only the API
# dist + production node_modules into a lean runtime image.
# ============================================================

# ---------- Stage 1: Install & Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules (pg, ioredis)
RUN apk add --no-cache python3 make g++

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files first (for layer caching)
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/impact-engine/package.json packages/impact-engine/

# Install all dependencies (workspace-aware)
RUN npm ci

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY packages/impact-engine/ packages/impact-engine/
COPY apps/api/ apps/api/

# Build all packages via Turborepo (respects dependency graph)
RUN npx turbo run build --filter=@fuelripple/api...

# ---------- Stage 2: Production ----------
FROM node:20-alpine AS runner

WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fuelripple

# Copy workspace root for npm workspace resolution
COPY package.json package-lock.json ./

# Copy built packages
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/

COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist/ packages/db/dist/
COPY --from=builder /app/packages/db/knexfile.js packages/db/
COPY --from=builder /app/packages/db/migrations/ packages/db/migrations/
COPY --from=builder /app/packages/db/seeds/ packages/db/seeds/

COPY --from=builder /app/packages/impact-engine/package.json packages/impact-engine/
COPY --from=builder /app/packages/impact-engine/dist/ packages/impact-engine/dist/

COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist/ apps/api/dist/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=@fuelripple/api --workspace=@fuelripple/db --workspace=@fuelripple/shared --workspace=@fuelripple/impact-engine

# Switch to non-root user
USER fuelripple

# Expose API port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
