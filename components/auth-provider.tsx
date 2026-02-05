/**
 * Auth Provider - React Context for Supabase Authentication
 *
 * Provides session state and authentication methods to client components.
 */

'use client';

import { createClient } from '@/lib/supabase/create-client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Authentication context type
 */
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component - wraps the app to provide auth state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  /**
   * Force refresh the session
   */
  const refreshSession = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { session, loading } = useAuth();
  return !loading && session !== null;
}

/**
 * Hook to get current user
 */
export function useUser(): User | null {
  const { user, loading } = useAuth();
  return loading ? null : user;
}
