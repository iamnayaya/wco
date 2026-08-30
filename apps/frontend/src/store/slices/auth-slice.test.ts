import { beforeEach, describe, it, expect } from 'vitest';
import { useAuthStore } from './auth-slice';

const USER = {
  id: 'usr_01',
  email: 'nkechi@wco.test',
  fullName: 'Nkechi Okafor',
  role: 'OWNER',
  merchant: { id: 'mch_01', companyName: 'Mama Nkechi Foods', plan: 'pro' },
};

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('starts logged out', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.activeStoreId).toBeNull();
  });

  it('setSession stores user and access token', () => {
    useAuthStore.getState().setSession(USER, 'access-token-1');
    const s = useAuthStore.getState();
    expect(s.user?.email).toBe('nkechi@wco.test');
    expect(s.accessToken).toBe('access-token-1');
  });

  it('setActiveStore updates the active store id', () => {
    useAuthStore.getState().setActiveStore('mch_02');
    expect(useAuthStore.getState().activeStoreId).toBe('mch_02');
  });

  it('clearSession wipes identity, token and active store', () => {
    useAuthStore.getState().setSession(USER, 'access-token-1');
    useAuthStore.getState().setActiveStore('mch_02');
    useAuthStore.getState().clearSession();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.activeStoreId).toBeNull();
  });

  it('partialize persists identity but never the short-lived access token', () => {
    // Security-critical: the persist partialize contract must drop the access
    // token so it is never written to localStorage. Assert the contract
    // directly rather than depending on jsdom storage timing.
    const { partialize } = useAuthStore.persist.getOptions();
    useAuthStore.getState().setSession(USER, 'access-token-1');
    useAuthStore.getState().setActiveStore('mch_02');

    const persisted = partialize?.(useAuthStore.getState()) ?? {};
    expect(persisted.user?.email).toBe('nkechi@wco.test');
    expect(persisted.activeStoreId).toBe('mch_02');
    expect(persisted.accessToken).toBeUndefined();
    expect(persisted.refreshToken).toBeUndefined();
  });
});
