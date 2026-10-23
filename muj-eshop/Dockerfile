FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci

FROM dependencies AS server-build
COPY apps/server apps/server
RUN npm run build -w server

FROM node:22-bookworm-slim AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY --from=server-build /app/apps/server/dist apps/server/dist
COPY --from=server-build /app/apps/server/static apps/server/static
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]

FROM dependencies AS storefront-build
ARG VENDURE_SHOP_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SITE_NAME=muj-eshop
ARG NEXT_PUBLIC_ASSET_URL
ENV VENDURE_SHOP_API_URL=$VENDURE_SHOP_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_ASSET_URL=$NEXT_PUBLIC_ASSET_URL
COPY apps/storefront apps/storefront
RUN npm run build -w storefront

FROM node:22-bookworm-slim AS storefront
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=storefront-build /app/apps/storefront/.next/standalone ./
COPY --from=storefront-build /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=storefront-build /app/apps/storefront/public ./apps/storefront/public
CMD ["node", "apps/storefront/server.js"]
