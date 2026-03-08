/**
 * Auth Store Unit Tests
 *
 * Tests for the authentication store with hardcoded credentials
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Create a proper store object for localStorage mock
const localStorageStore: Record<string, string> = {};

// Mock localStorage with proper function bindings
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] || null),
  setItem: jest.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: jest.fn((key: string) => { delete localStorageStore[key]; }),
  clear: jest.fn(() => { for (const key in localStorageStore) delete localStorageStore[key]; }),
  store: localStorageStore,
};

// Define localStorage on both global and window (for SSR compatibility)
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

// Also set on window for zustand's getStorage() function
Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    localStorage: localStorageMock,
  },
  configurable: true,
  writable: true,
});

describe('AuthStore', () => {
  beforeEach(() => {
    // Clear the mock store and reset mocks
    for (const key in localStorageStore) delete localStorageStore[key];
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    // Clear module cache to get fresh store
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Hardcoded Credentials', () => {
    it('should have user@techtrend.com with password123', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      const result = useAuthStore.getState().login('user@techtrend.com', 'password123');
      expect(result).toBe(true);
    });

    it('should have admin@techtrend.com with admin456', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      const result = useAuthStore.getState().login('admin@techtrend.com', 'admin456');
      expect(result).toBe(true);
    });

    it('should reject invalid password', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      const result = useAuthStore.getState().login('user@techtrend.com', 'wrongpassword');
      expect(result).toBe(false);
    });

    it('should reject unknown email', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      const result = useAuthStore.getState().login('unknown@test.com', 'password123');
      expect(result).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create session on successful login', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      const result = useAuthStore.getState().login('user@techtrend.com', 'password123');

      expect(result).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('user@techtrend.com');
    });

    it('should clear session on logout', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');

      // Login first
      useAuthStore.getState().login('user@techtrend.com', 'password123');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Logout
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should set session expiry on login', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      useAuthStore.getState().login('user@techtrend.com', 'password123');

      const expiry = useAuthStore.getState().sessionExpiry;
      expect(expiry).toBeGreaterThan(Date.now());
      // Should be ~24 hours from now
      expect(expiry).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('User Profile', () => {
    it('should return correct user profile for regular user', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      useAuthStore.getState().login('user@techtrend.com', 'password123');

      const user = useAuthStore.getState().user;
      expect(user?.email).toBe('user@techtrend.com');
      expect(user?.name).toBe('Test User');
      expect(user?.role).toBe('user');
    });

    it('should return correct user profile for admin', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      useAuthStore.getState().login('admin@techtrend.com', 'admin456');

      const user = useAuthStore.getState().user;
      expect(user?.email).toBe('admin@techtrend.com');
      expect(user?.name).toBe('Admin User');
      expect(user?.role).toBe('admin');
    });
  });

  describe('Persistence', () => {
    it('should persist session to localStorage', async () => {
      const { useAuthStore } = await import('../../lib/auth/store.js');
      useAuthStore.getState().login('user@techtrend.com', 'password123');

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should restore session from localStorage', async () => {
      // Setup mock to return stored session BEFORE importing
      const storedSession = {
        state: {
          user: {
            id: 'test-id',
            email: 'user@techtrend.com',
            name: 'Test User',
            role: 'user',
          },
          isAuthenticated: true,
          sessionExpiry: Date.now() + 24 * 60 * 60 * 1000,
        },
        version: 0,
      };

      // Set up the mock return value
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth-storage') {
          return JSON.stringify(storedSession);
        }
        return null;
      });

      // Import fresh store
      const { useAuthStore } = await import('../../lib/auth/store.js');

      // Check that session was restored
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('user@techtrend.com');
    });

    it('should clear localStorage on logout', async () => {
      // Setup: store the session in localStorageStore directly
      const storedSession = {
        state: {
          user: {
            id: 'test-id',
            email: 'user@techtrend.com',
            name: 'Test User',
            role: 'user',
          },
          isAuthenticated: true,
          sessionExpiry: Date.now() + 24 * 60 * 60 * 1000,
        },
        version: 0,
      };
      localStorageStore['auth-storage'] = JSON.stringify(storedSession);

      // Import fresh store with session restored
      const { useAuthStore } = await import('../../lib/auth/store.js');

      // Verify session was restored
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Now logout
      useAuthStore.getState().logout();

      // Check that removeItem was called
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth-storage');
    });
  });

  describe('Session Expiry', () => {
    it('should reject expired session on store initialization', async () => {
      // Setup mock to return expired session
      const expiredSession = {
        state: {
          user: {
            id: 'test-id',
            email: 'user@techtrend.com',
            name: 'Test User',
            role: 'user',
          },
          isAuthenticated: true,
          sessionExpiry: Date.now() - 1000, // Already expired
        },
        version: 0,
      };

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'auth-storage') {
          return JSON.stringify(expiredSession);
        }
        return null;
      });

      const { useAuthStore } = await import('../../lib/auth/store.js');

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
