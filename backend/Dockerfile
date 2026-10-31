# syntax=docker/dockerfile:1

# ---------- build: cài đủ thư viện (gồm dev) và biên dịch TypeScript ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
# Prisma cần OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---------- runtime: chỉ thư viện cần khi chạy + Prisma CLI để chạy migration ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `prisma` (CLI) đang là devDependency: cài thêm đúng phiên bản trong package-lock để chạy `prisma migrate deploy`
RUN npm ci --omit=dev \
 && npm install --no-save "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
 && npx prisma generate \
 && npm cache clean --force
COPY --from=build /app/dist ./dist
# Không chạy bằng root
USER node
EXPOSE 3000
# Cùng một image: api chạy `node dist/main`, worker chạy `node dist/worker`, migrate chạy `npx prisma migrate deploy`
CMD ["node", "dist/main"]
