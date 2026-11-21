import apiClient, { tokenStorage } from './api'
import type { AuthTokens, User, Workspace } from '@/types'

export interface MeResponse {
  user: User
  workspaces: Workspace[]
}

export const authService = {
  async register(email: string, password: string, display_name: string): Promise<AuthTokens> {
    const res = await apiClient.post('/auth/register', { email, password, display_name })
    const tokens: AuthTokens = res.data
    tokenStorage.set(tokens)
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.access_token}`
    return tokens
  },

  async login(email: string, password: string): Promise<AuthTokens> {
    const res = await apiClient.post('/auth/login', { email, password })
    const tokens: AuthTokens = res.data
    tokenStorage.set(tokens)
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.access_token}`
    return tokens
  },

  async refresh(refresh_token: string): Promise<AuthTokens> {
    const res = await apiClient.post('/auth/refresh', { refresh_token })
    const tokens: AuthTokens = res.data
    tokenStorage.set(tokens)
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.access_token}`
    return tokens
  },

  async getMe(): Promise<MeResponse> {
    const res = await apiClient.get('/auth/me')
    return res.data
  },
}
