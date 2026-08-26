import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000';

/**
 * Mobile API client with automatic token refresh.
 * Tokens live in device Keychain/Keystore (SecureStore) — never AsyncStorage.
 */
class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 15_000,
      headers: { 'X-Client': 'mobile' },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Single-flight refresh on 401
        if (
          error.response?.status === 401 &&
          !error.config?._retry &&
          !(error.config as any)?._isRefresh
        ) {
          const original = error.config!;
          (original as any)._retry = true;

          this.refreshPromise ??= this.refreshTokens();
          try {
            const newToken = await this.refreshPromise;
            this.refreshPromise = null;
            original.headers.Authorization = `Bearer ${newToken}`;
            return this.client(original);
          } catch {
            this.refreshPromise = null;
            await this.clearSession();
            // Emit global auth-expired event → navigate to login
            void Promise.resolve(); // event emitter wired in _layout.tsx
            throw error;
          }
        }
        throw error;
      },
    );
  }

  private async refreshTokens(): Promise<string> {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await axios.post(
      `${API_URL}/api/v1/auth/refresh`,
      {},
      {
        headers: { Cookie: `refresh_token=${refreshToken}` },
      },
    );

    const { accessToken, refreshToken: newRefresh } = response.data.data;
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', newRefresh);
    return accessToken;
  }

  private async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }

  get instance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;