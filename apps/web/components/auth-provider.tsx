'use client';

import { SessionProvider } from "next-auth/react";
import { ReactNode, createContext, useContext } from "react";
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

/**
 * AuthProvider component - wraps the app to provide NextAuth session state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NotificationsProvider>
        {children}
      </NotificationsProvider>
    </SessionProvider>
  );
}

// Re-implement simplified versions of hooks if they are used elsewhere
export function useAuth() {
  // This is a placeholder as useSession is more idiomatic in NextAuth
  return {};
}

export function useUser() {
  // Use useSession() instead in components
  return null;
}