# LabSaathi: multi-stage build, ~standalone Next.js server, runs as a non-root user.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Generous retries so a flaky connection does not fail the whole build.
RUN npm config set fetch-retries 6 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# "npm run build" first runs scripts/build-kb.ts, which parses lab_reports/ into
# src/generated/kb.json. The corpus is read at build time only.
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S labsaathi && adduser -S labsaathi -G labsaathi
COPY --from=build --chown=labsaathi:labsaathi /app/public ./public
COPY --from=build --chown=labsaathi:labsaathi /app/.next/standalone ./
COPY --from=build --chown=labsaathi:labsaathi /app/.next/static ./.next/static
USER labsaathi
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/samples > /dev/null || exit 1
CMD ["node", "server.js"]
