import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type User = { id: string; email: string; name: string; role: 'CUSTOMER' | 'ADMIN' };

type AuthStore = {
  user: User | null;
  token: string | null;
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const AGENT = process.env.EXPO_PUBLIC_AGENT_URL || 'http://localhost:8000';

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isReady: false,

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync('tt_token'),
        SecureStore.getItemAsync('tt_user'),
      ]);
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), isReady: true });
        return;
      }
    } catch {}
    set({ isReady: true });
  },

  signIn: async (email, password) => {
    // For now, create a mock user since /auth/signin may not exist yet
    const user: User = { id: 'mobile-user-1', email, name: email.split('@')[0], role: 'CUSTOMER' };
    const token = 'mock-token';
    await Promise.all([
      SecureStore.setItemAsync('tt_token', token),
      SecureStore.setItemAsync('tt_user', JSON.stringify(user)),
    ]);
    set({ token, user });
  },

  signOut: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('tt_token'),
      SecureStore.deleteItemAsync('tt_user'),
    ]);
    set({ token: null, user: null });
  },
}));
