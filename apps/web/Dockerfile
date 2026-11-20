FROM node:26.13.1-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --ignore-scripts --workspace @mycity/web --workspace @mycity/contracts --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY apps/web/index.html apps/web/vite.config.ts apps/web/tsconfig.json apps/web/
COPY apps/web/src apps/web/src
COPY apps/web/public apps/web/public
RUN npm run build:contracts && npm run build -w @mycity/web

FROM nginx:1.28-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
