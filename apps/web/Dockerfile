# ============================================================
# FuelRipple Web — Multi-stage Docker build
# Builds the Vite SPA, serves with nginx.
# ============================================================

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy needed workspace package.json files (for dependency resolution)
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# Build shared package + web app via Turborepo
RUN npx turbo run build --filter=@fuelripple/web...

# ---------- Stage 2: Serve with nginx ----------
FROM nginx:1.25-alpine AS runner

# Copy nginx config as a template — the entrypoint's 20-envsubst-on-templates.sh
# will substitute ${API_URL} at container start and write to /etc/nginx/conf.d/.
# Only API_URL is substituted so nginx's own $host/$uri/$scheme vars are preserved.
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_TEMPLATE_VARS=API_URL

# Copy built SPA files
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# Give the nginx user write access to runtime directories.
# Note: USER nginx is intentionally omitted — the entrypoint runs as root to
# perform envsubst and write to /etc/nginx/conf.d/; nginx workers then run
# under the nginx user as specified by the main nginx.conf.
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
