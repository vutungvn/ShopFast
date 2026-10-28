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
