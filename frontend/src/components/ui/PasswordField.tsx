import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { TextField, type TextFieldProps } from './TextField'

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'endAdornment'>

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          className="rounded-md p-2 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
    />
  )
}
