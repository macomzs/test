# Jeden plik budujący trzy obrazy: web (panel), worker (zadania w tle) i migrate (migracje + dane startowe).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/platform/package.json packages/platform/
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

FROM source AS web-build
RUN NEXT_OUTPUT=standalone pnpm --filter @app/web build

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=web-build --chown=app /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=app /app/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

FROM source AS worker
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/worker
CMD ["node_modules/.bin/tsx", "src/index.ts"]

FROM source AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "db:setup"]
