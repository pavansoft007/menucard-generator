# syntax=docker/dockerfile:1

# ---- build: compile the web app and bundle the API ----------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci
COPY . .
RUN npm run build -w @gc/web && npm run build -w @gc/api

# ---- runtime: one process serves the API, the web app and the PDF renderer -----------------------
FROM node:22-bookworm-slim
# Chromium renders the PDF / PNG exports; fonts-liberation covers any fallback glyphs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=true \
    RENDER_BASE_URL=http://localhost:4000

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist

# Uploaded images and exported files live outside the image: mount volumes on these two folders.
RUN mkdir -p /app/uploads /app/exports && chown -R node:node /app/uploads /app/exports
VOLUME ["/app/uploads", "/app/exports"]

USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
