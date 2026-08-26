import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../../lib/api/client';

export interface MobileUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: MobileUser | null;
  accessToken: string | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Mobile auth — tokens in Keychain/Keystore via SecureStore.
 * Zustand holds the in-memory mirror for reactive navigation.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,

  login: async (email, password) => {
    const { data } = await apiClient.post<{
      data: { accessToken: string; refreshToken: string; user: MobileUser };
    }>('/auth/login', { email, password });

    await SecureStore.setItemAsync('access_token', data.data.accessToken);
    await SecureStore.setItemAsync('refresh_token', data.data.refreshToken);
    set({ user: data.data.user, accessToken: data.data.accessToken });
  },

  logout: async () => {
    await apiClient.post('/auth/logout').catch(() => undefined);
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, accessToken: null });
  },
}));

/** Restore session on cold start; silent failure = logged out. */
export async function hydrateSession(): Promise<void> {
  try {
    const accessToken = await SecureStore.getItemAsync('access_token');
    if (accessToken) {
      const { data } = await apiClient.get<{ data: MobileUser }>('/auth/me');
      useAuthStore.setState({ user: data.data, accessToken });
    }
  } catch {
    // Token invalid/expired beyond refresh — stay logged out
  } finally {
    useAuthStore.setState({ hydrated: true });
  }
}
