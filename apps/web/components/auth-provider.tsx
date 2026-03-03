'use client';

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/**
 * AuthProvider component - wraps the app to provide NextAuth session state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
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