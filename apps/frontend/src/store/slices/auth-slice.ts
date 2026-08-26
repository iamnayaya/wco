import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  merchant: { id: string; companyName: string; plan: string };
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  activeStoreId: string | null;
  setSession: (user: SessionUser, accessToken: string) => void;
  setActiveStore: (storeId: string) => void;
  clearSession: () => void;
}

/**
 * Auth store — access token in memory + localStorage persist.
 * Refresh token stays in an httpOnly cookie (never touches JS).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      activeStoreId: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setActiveStore: (storeId) => set({ activeStoreId: storeId }),
      clearSession: () => set({ user: null, accessToken: null, activeStoreId: null }),
    }),
    {
      name: 'wco-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) =>
        // Access tokens are short-lived (15m); persisting them across reloads
        // trades a re-auth for UX. Keep only identity for UI rendering.
        ({ user: state.user, activeStoreId: state.activeStoreId }),
    },
  ),
);
