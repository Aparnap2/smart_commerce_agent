/**
 * Auth Store - Hardcoded Authentication for Demo
 *
 * Zustand store with hardcoded credentials for secure access to private data.
 * Session expires after 24 hours and persists to localStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * User type for authenticated users
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

/**
 * Auth state interface
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  sessionExpiry: number;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  checkExpiry: () => void;
}

/**
 * Session duration: 24 hours in milliseconds
 */
const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * Storage key for auth data
 */
const STORAGE_KEY = 'auth-storage';

/**
 * Hardcoded credentials for demo purposes
 * In production, this would be replaced with real authentication
 */
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'user@techtrend.com': {
    password: 'password123',
    user: {
      id: 'user-1',
      email: 'user@techtrend.com',
      name: 'Test User',
      role: 'user',
    },
  },
  'admin@techtrend.com': {
    password: 'admin456',
    user: {
      id: 'admin-1',
      email: 'admin@techtrend.com',
      name: 'Admin User',
      role: 'admin',
    },
  },
};

/**
 * Get localStorage implementation (handles SSR/server-side)
 */
function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

/**
 * Clear auth storage
 */
function clearAuthStorage(): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore errors (e.g., in SSR context)
  }
}

/**
 * Auth store with persistence
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      sessionExpiry: 0,

      /**
       * Login with email and password
       * Returns true if credentials are valid
       */
      login: (email: string, password: string): boolean => {
        const normalizedEmail = email.toLowerCase().trim();
        const demoUser = DEMO_USERS[normalizedEmail];

        if (demoUser && demoUser.password === password) {
          const sessionExpiry = Date.now() + SESSION_DURATION;

          set({
            user: demoUser.user,
            isAuthenticated: true,
            sessionExpiry,
          });

          console.log(`[AUTH] ✅ Login successful for ${normalizedEmail}`);
          return true;
        }

        console.log(`[AUTH] ❌ Login failed for ${normalizedEmail}`);
        return false;
      },

      /**
       * Logout and clear session
       */
      logout: () => {
        const currentUser = get().user?.email;

        set({
          user: null,
          isAuthenticated: false,
          sessionExpiry: 0,
        });

        // Explicitly clear localStorage on logout
        clearAuthStorage();

        console.log(`[AUTH] 🚪 Logout${currentUser ? ` for ${currentUser}` : ''}`);
      },

      /**
       * Check if session has expired
       * Called on store initialization
       */
      checkExpiry: () => {
        const { sessionExpiry, isAuthenticated } = get();

        if (isAuthenticated && sessionExpiry > 0 && Date.now() > sessionExpiry) {
          console.log('[AUTH] ⏰ Session expired');
          set({
            user: null,
            isAuthenticated: false,
            sessionExpiry: 0,
          });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Check expiry when restoring from localStorage
        if (state) {
          state.checkExpiry();
        }
      },
    }
  )
);

/**
 * Export demo users for testing
 */
export const DEMO_CREDENTIALS = DEMO_USERS;
