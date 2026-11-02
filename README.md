# ShopFast

Sàn thương mại điện tử bán đồ công nghệ, tích hợp trợ lý AI chăm sóc khách hàng, theo dõi đơn hàng realtime, cache, rate limit, triển khai Docker trên AWS EC2 với CI/CD.

🌐 Production: <https://shopfast.3utilities.com> · Tài liệu API (Swagger): <https://shopfast.3utilities.com/docs>

## Tính năng chính

| Nhóm | Nội dung |
|---|---|
| Mua sắm | Danh mục sản phẩm có lọc (danh mục, giá, thương hiệu, còn hàng), tìm kiếm, phân trang; giỏ hàng; đặt đơn chống bán vượt; thanh toán giả lập; tự huỷ đơn quá hạn thanh toán |
| Đơn hàng | Vòng đời `Chờ thanh toán → Đã thanh toán → Đã xác nhận → Đóng gói → Đang giao → Đã giao` / `Đã huỷ`, lịch sử trạng thái; kho xử lý đơn, quản lý tồn kho |
| Realtime | Khách thấy trạng thái đơn đổi ngay khi kho cập nhật (Socket.IO, xác thực JWT lúc bắt tay); chat hỗ trợ realtime |
| Trợ lý AI (Gemini) | Cửa sổ chat cho khách; tự phân loại yêu cầu; tra đơn hàng / tồn kho bằng dữ liệu thật; từ chối câu hỏi ngoài phạm vi, không bịa thông tin; yêu cầu huỷ đơn chỉ tạo **đề xuất** chờ CSKH duyệt |
| CSKH | Hàng đợi yêu cầu hỗ trợ, tiếp nhận / trả lại cho AI, duyệt hoặc từ chối đề xuất của AI |
| Hiệu năng & bảo vệ | Cache Redis (chi tiết / danh sách sản phẩm, chống stampede), rate limit theo tài khoản / IP, chống dò mật khẩu, 429 kèm thời gian chờ |

Vai trò: `CUSTOMER` (khách), `WAREHOUSE` (kho), `SUPPORT` (CSKH), `ADMIN`.

## Công nghệ

- **Backend:** NestJS 10, Node.js 20, TypeScript, Prisma, PostgreSQL 16, Redis 7, Socket.IO (Redis adapter), Google Gemini (`@google/genai`)
- **Frontend:** React 19, Vite, TypeScript, TanStack Query, React Router, Tailwind CSS v4
- **Hạ tầng:** Docker Compose, Nginx (HTTPS Let's Encrypt), AWS EC2, GitHub Actions

```
Trình duyệt ──HTTPS──▶ Nginx (web: frontend tĩnh)
                         ├─ /api, /docs, /health ─▶ api (NestJS) ─┬─▶ PostgreSQL
                         └─ /socket.io (WebSocket) ─▶ api         ├─▶ Redis (cache, rate limit, realtime)
                                                                  └─▶ Gemini API
                         worker (NestJS) ─ tự huỷ đơn quá hạn ─▶ PostgreSQL, Redis
```

## Cấu trúc thư mục

```
backend/     API + worker NestJS (src/modules/*), Prisma schema, migration, seed, test
frontend/    Ứng dụng React (src/features/*: catalog, cart, orders, staff, support)
deploy/      Script deploy trên EC2, cấu hình Nginx HTTPS
docker-compose.yml        PostgreSQL + Redis cho môi trường dev
docker-compose.prod.yml   Toàn bộ hệ thống production (+ docker-compose.https.yml)
```

## Chạy cục bộ

Yêu cầu: Node.js 20+, Docker.

```bash
# 1. PostgreSQL (cổng 5434) + Redis (cổng 6380)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # điền DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, GEMINI_API_KEY
npm install
npx prisma migrate dev        # tạo bảng
npm run db:seed               # dữ liệu mẫu: sản phẩm, tài khoản, đơn hàng
npm run dev                   # API: http://localhost:3000 · Swagger: /docs
npm run start:worker:dev      # (terminal khác) worker tự huỷ đơn quá hạn

# 3. Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api, /socket.io sang cổng 3000)
```

**Tài khoản mẫu** (mật khẩu mặc định `MatKhau123`, đổi bằng `SEED_PASSWORD`):
`admin@shopfast.vn`, `kho@shopfast.vn`, `cskh@shopfast.vn`, `khach01@shopfast.vn` … `khach20@shopfast.vn`

## Biến môi trường chính (`backend/.env`)

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Kết nối PostgreSQL, vd `postgresql://shopfast:shopfast@127.0.0.1:5434/shopfast?schema=public` |
| `REDIS_URL` | Kết nối Redis, vd `redis://127.0.0.1:6380` |
| `JWT_ACCESS_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự |
| `GEMINI_API_KEY` | Khoá Gemini (tạo ở [Google AI Studio](https://aistudio.google.com)). Để trống thì trợ lý AI tắt, nhân viên xử lý yêu cầu |
| `GEMINI_MODEL` | Mặc định `gemini-3.5-flash-lite` |
| `ORDER_PAYMENT_TIMEOUT_MINUTES` | Hạn thanh toán đơn (mặc định 1440) |
| `THROTTLE_*` | Hạn mức rate limit |

Danh sách đầy đủ có chú thích: [`backend/.env.example`](backend/.env.example). **Không commit `.env` / `.env.prod`.**

## Kiểm thử

```bash
cd backend
npm run lint:check && npm run format:check
npm test              # unit test
npm run test:e2e      # e2e (cần PostgreSQL + Redis đang chạy)

cd frontend
npm run lint && npm run build
```

## Triển khai

- **CI** (`.github/workflows/ci.yml`): mỗi PR chạy lint, unit, e2e (backend) và lint, build (frontend); lỗi thì chặn merge vào `main`.
- **CD** (`.github/workflows/deploy.yml`): CI trên `main` xanh → SSH vào EC2 chạy [`deploy/deploy.sh`](deploy/deploy.sh): kéo code, build image, chạy migration, khởi động lại dịch vụ và kiểm tra `/health`.
- Chạy production thủ công trên server:

```bash
cp prod.env.example .env.prod   # điền mật khẩu DB, JWT, GEMINI_API_KEY, DOMAIN...
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml --env-file .env.prod up -d --build
```
