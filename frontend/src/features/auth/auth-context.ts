import { createContext, useContext } from 'react'
import type { SignedOutReason, User } from './types'

export type AuthState =
  | { status: 'loading'; user: null; signedOutReason: null }
  | { status: 'authenticated'; user: User; signedOutReason: null }
  | { status: 'anonymous'; user: null; signedOutReason: SignedOutReason | null }

export type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return context
}
