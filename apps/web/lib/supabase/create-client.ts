/**
 * Supabase Client Stub
 *
 * This file is a stub for legacy Supabase imports.
 * The project has migrated to a custom auth system.
 */

// Stub types to prevent TypeScript errors
export interface SupabaseClient {
  auth: {
    signUp: (params: any) => Promise<{ error?: any }>;
    signIn: (params: any) => Promise<{ error?: any }>;
    signOut: () => Promise<{ error?: any }>;
    resetPasswordForEmail: (email: string, options?: any) => Promise<{ error?: any }>;
    exchangeCodeForSession: (code: string) => Promise<{ error?: any }>;
  };
  channel: (name: string, options?: any) => {
    on: (event: string, filter: any, callback: any) => any;
    subscribe: (callback: any) => any;
  };
  removeChannel: (channel: any) => void;
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: any) => {
        order: (column: string, options?: any) => Promise<{ data?: any; error?: any }>;
      };
    };
    insert: (data: any) => {
      select: () => {
        single: () => Promise<{ data?: any; error?: any }>;
      };
    };
    update: (data: any) => {
      eq: (column: string, value: any) => Promise<{ error?: any }>;
    };
  };
}

export type { SupabaseClient as AuthSession };

// Stub function - returns a mock client
export function createClient(): SupabaseClient {
  return {
    auth: {
      signUp: async () => ({ error: null }),
      signIn: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
    },
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({}) }), subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  };
}

// Server-side client stub
export function createServerClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: any
): SupabaseClient {
  return createClient();
}
