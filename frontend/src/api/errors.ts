import axios from 'axios'

/** Thông báo hiển thị cho người dùng. Backend trả `message` là chuỗi (lỗi nghiệp vụ) hoặc mảng (lỗi validate). */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Không kết nối được máy chủ, vui lòng kiểm tra mạng và thử lại'
    if (error.response.status >= 500) return 'Máy chủ đang gặp sự cố, vui lòng thử lại sau'
    const message: unknown = error.response.data?.message
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
    if (typeof message === 'string') return message
  }
  return 'Đã có lỗi xảy ra, vui lòng thử lại'
}

export function getErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
