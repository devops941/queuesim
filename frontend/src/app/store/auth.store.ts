import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Workspace, AuthTokens } from '@/types'
import { tokenStorage } from '@/services/api'

interface AuthState {
  user: User | null
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isAuthenticated: boolean
  setAuth: (user: User, workspaces: Workspace[], tokens: AuthTokens) => void
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspace: (id: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      isAuthenticated: false,

      setAuth: (user, workspaces, tokens) => {
        tokenStorage.set(tokens)
        set({
          user,
          workspaces,
          activeWorkspaceId: workspaces[0]?.id ?? null,
          isAuthenticated: true,
        })
      },

      setWorkspaces: (workspaces) => set({ workspaces }),

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      logout: () => {
        tokenStorage.clear()
        set({ user: null, workspaces: [], activeWorkspaceId: null, isAuthenticated: false })
      },
    }),
    {
      name: 'qs-auth',
      partialize: (state) => ({
        user: state.user,
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
