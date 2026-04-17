# syntax=docker/dockerfile:1
# Based on the official Next.js Docker example:
# https://github.com/vercel/next.js/tree/canary/examples/with-docker

ARG NODE_VERSION=20-slim

# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ============================================================
# Stage 2: Build the Next.js app
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================================
# Stage 3: Runner (minimal production image)
# ============================================================
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy public assets and standalone output
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Pre-create .next directory with correct ownership for the image cache
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone output includes a trimmed server.js + node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
