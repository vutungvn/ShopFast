import type { FieldErrors } from '@/hooks/useForm'
import type { ShippingInfo } from './types'

// Khớp CreateOrderDto của backend để báo lỗi ngay trên form; backend vẫn kiểm tra lại.
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/
export const MAX_ADDRESS = 500

export function validateShipping(values: ShippingInfo): FieldErrors<ShippingInfo> {
  const errors: FieldErrors<ShippingInfo> = {}
  const name = values.recipientName.trim()
  const address = values.shippingAddress.trim()

  if (name.length < 2) errors.recipientName = 'Tên người nhận phải có ít nhất 2 ký tự'
  else if (name.length > 100) errors.recipientName = 'Tên người nhận tối đa 100 ký tự'

  if (!PHONE_PATTERN.test(values.recipientPhone.trim())) errors.recipientPhone = 'Số điện thoại không hợp lệ'

  if (address.length < 10) errors.shippingAddress = 'Địa chỉ nhận hàng phải có ít nhất 10 ký tự'
  else if (address.length > MAX_ADDRESS) errors.shippingAddress = `Địa chỉ nhận hàng tối đa ${MAX_ADDRESS} ký tự`

  return errors
}
