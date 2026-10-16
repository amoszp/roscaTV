# =============================================================================
# WHY THE NGINX DOCKERFILE FROM THE SPEC IS INCOMPATIBLE WITH NEXT.JS
# =============================================================================
# The spec's Stage 2 copies /app/dist into Nginx. That pattern is for
# single-page apps (Vite, Create React App) that produce a fully static
# bundle. Next.js 14 App Router is a Node.js server application:
#   • It produces /app/.next (compiled server + client code)
#   • It requires `next start` (a Node process) to serve pages
#   • It supports SSR, API routes, and ISR — none of which work behind Nginx
#     serving flat static files
#   • Even for purely static exports (`output: 'export'`), Next.js writes
#     to /app/out, not /app/dist
#
# CORRECT APPROACH: Two-stage build preserved, Stage 2 uses node:20-alpine
# instead of Nginx. Nginx could be added as a reverse proxy in front of
# this container (e.g. in docker-compose), but the app itself must run Node.
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Build
# -----------------------------------------------------------------------------
# Node 24: the server keeps its data with the built-in node:sqlite.
FROM node:24-alpine AS builder

# Install libc compat for Alpine (required by some native Node modules)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency manifests first — Docker cache layer
COPY package*.json ./

# Clean install — respects package-lock.json exactly (reproducible)
RUN npm ci

# Copy the rest of the project
COPY . .

# Build environment variables (no secrets — only public config)
# Override at runtime via docker run -e or docker-compose environment:
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# 1 = sign-in screen + library kept on this server (see README). The image is
# always built this way; plain hosting without a server builds with 0.
ARG NEXT_PUBLIC_SERVER_SYNC=1
ENV NEXT_PUBLIC_SERVER_SYNC=$NEXT_PUBLIC_SERVER_SYNC

# Build the Next.js application
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 2: Production runtime
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default port — override with -e PORT=xxxx
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what next start needs (excludes source, devDeps, test fixtures)
COPY --from=builder /app/public         ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static   ./.next/static

# The SQLite database lives in /app/data (mount a host folder there; it must
# be writable by uid 1001).
ENV DB_PATH=/app/data/roscatv.db
RUN mkdir -p /app/data

# Own the app directory
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# next start via the standalone server.js (smallest possible runtime footprint)
CMD ["node", "server.js"]
