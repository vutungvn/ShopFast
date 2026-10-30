const priceFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

/** 22990000 => "22.990.000 ₫" */
export function formatPrice(value: number) {
  return priceFormat.format(value)
}

const numberFormat = new Intl.NumberFormat('vi-VN')

/** 50000000 => "50.000.000" (dùng cho ô nhập số tiền) */
export function formatNumber(value: number) {
  return numberFormat.format(value)
}

/** "Nguyễn Văn An" => "NA" */
export function getInitials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
})

/** "2026-10-30T07:32:00Z" => "14:32, 30/10/2026" (giờ Việt Nam) */
export function formatDateTime(value: string | Date) {
  const parts = Object.fromEntries(
    dateTimeFormat.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  )
  return `${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}`
}

/** 86_100_000 => "23 giờ 55 phút"; dưới 1 phút => "dưới 1 phút" */
export function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'dưới 1 phút'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} phút`
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`
}
