FROM node:26.13.1-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace @mycity/api --workspace @mycity/contracts --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY apps/api/tsconfig*.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src apps/api/src
RUN npm run db:generate -w @mycity/api && npm run build:contracts && npm run build -w @mycity/api
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@mycity/api"]

FROM build AS production-dependencies
USER root
RUN npm prune --omit=dev --workspace @mycity/api --workspace @mycity/contracts --include-workspace-root

FROM node:26.13.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
