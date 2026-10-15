# ShopFast

Backend cho sàn thương mại điện tử ShopFast: NestJS 10, Node.js 20, PostgreSQL 16, Redis 7, Prisma.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `backend/` | API NestJS (`src/main.ts`) và Worker xử lý nền (`src/worker.ts`) |
| `frontend/` | UI web tối thiểu (đang phát triển) |
| `docker-compose.yml` | PostgreSQL, Redis, Mailpit cho môi trường cục bộ |

## Chạy cục bộ

Yêu cầu: Node.js 20+, Docker.

```bash
# 1. Hạ tầng (PostgreSQL :5434, Redis :6380, Mailpit :8025)
docker compose up -d --wait

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run db:migrate

# 3. Chạy API và Worker (2 terminal)
npm run start:dev
npm run start:worker:dev
```

Kiểm tra: `curl http://localhost:3000/health` trả về trạng thái kết nối database và Redis.
Email gửi trong môi trường dev xem tại http://localhost:8025.

## Lệnh thường dùng (trong `backend/`)

| Lệnh | Mô tả |
|---|---|
| `npm run lint:check` / `npm run format:check` | Kiểm tra lint và định dạng |
| `npm test` | Unit test |
| `npm run test:e2e` | Integration test (cần hạ tầng đang chạy) |
| `npm run db:migrate` | Tạo và áp dụng migration |
| `npm run db:studio` | Xem dữ liệu bằng Prisma Studio |
