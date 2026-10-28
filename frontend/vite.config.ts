import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Không có tiền tố VITE_ nên chỉ dùng trong cấu hình, không lọt vào code chạy trên trình duyệt
  const { API_PROXY_TARGET = 'http://localhost:3000' } = loadEnv(mode, import.meta.dirname, '')

  // Chuyển /api sang backend để trình duyệt coi là cùng nguồn: cookie refresh (SameSite=Strict,
  // Path=/api/v1/auth) hoạt động mà không cần CORS. Production làm tương tự bằng Nginx.
  const proxy = { '/api': API_PROXY_TARGET }

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: { proxy },
    preview: { proxy },
  }
})
