'use client';

import { ReactNode, createContext, useContext, useState, useEffect } from "react";
import { createBrowserClient } from '@supabase/ssr'
import { usePRNotifications } from "@/hooks/usePRNotifications";

const NotificationsContext = createContext<ReturnType<typeof usePRNotifications> | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

function NotificationsProvider({ children }: { children: ReactNode }) {
  const notifications = usePRNotifications();
  return (
    <NotificationsContext.Provider value={notifications}>
      {children}
    </NotificationsContext.Provider>
  );
}

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:9999',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon'
    )
    
    // Check for JWT token in cookie
    const token = document.cookie.split('token=')[1]?.split(';')[0]
    if (token) {
      // Decode JWT to get user info (simplified)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setSession({ 
          user: { 
            id: payload.userId, 
            email: payload.email 
          } 
        })
      } catch (e) {
        console.error('Failed to parse token:', e)
      }
    }
    setLoading(false)
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  return (
    <NotificationsProvider>
      {children}
    </NotificationsProvider>
  );
}

/**
 * AuthProvider - wraps the app with Supabase auth (replaced NextAuth)
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
  return {};
}

export function useUser() {
  return null;
}