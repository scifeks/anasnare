# Stage 1: Build UI
FROM node:24-slim AS ui-build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/server/package.json packages/server/
COPY packages/scanner/package.json packages/scanner/
RUN npm ci
COPY packages/ui/ packages/ui/
RUN npm run build --workspace=packages/ui

# Stage 2: Build server + scanner TypeScript, and production node_modules
FROM node:24-slim AS server-build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/server/package.json packages/server/
COPY packages/scanner/package.json packages/scanner/
COPY packages/ui/package.json packages/ui/
RUN npm ci
COPY packages/server/ packages/server/
COPY packages/scanner/ packages/scanner/
RUN npm run build --workspace=packages/scanner && npm run build --workspace=packages/server
# Clean production deps with native addon already compiled
RUN rm -rf node_modules && npm ci --workspace=packages/server --workspace=packages/scanner --omit=dev

# Stage 3: Production
FROM mcr.microsoft.com/playwright:v1.64.1-jammy AS production
WORKDIR /app
COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/scanner/package.json packages/scanner/
COPY --from=server-build /app/node_modules node_modules/
COPY --from=server-build /app/packages/server/node_modules packages/server/node_modules/
COPY --from=server-build /app/packages/scanner/node_modules packages/scanner/node_modules/
COPY --from=server-build /app/packages/server/dist packages/server/dist
COPY --from=server-build /app/packages/scanner/dist packages/scanner/dist
COPY --from=ui-build /app/packages/ui/dist packages/ui/dist
RUN npx playwright install chromium
RUN useradd -m -s /bin/bash anasnare && mkdir -p /app/data && chown -R anasnare:anasnare /app
USER anasnare

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/anasnare.db
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
