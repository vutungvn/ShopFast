// Các bộ e2e đăng nhập rất nhiều lần từ cùng một IP: tắt rate limit (bộ test riêng tự bật lại)
process.env.THROTTLE_DISABLED ??= 'true';
