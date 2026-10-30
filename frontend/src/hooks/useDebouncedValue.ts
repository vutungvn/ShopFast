import { useEffect, useState } from 'react'

/** Giá trị chỉ đổi sau khi `value` đứng yên `delayMs` (gõ ô tìm kiếm không gọi API mỗi phím) */
export function useDebouncedValue<T>(value: T, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
