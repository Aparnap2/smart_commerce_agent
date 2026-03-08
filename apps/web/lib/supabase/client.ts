/**
 * Supabase Client Stub
 *
 * This file is a stub for legacy Supabase imports.
 * The project has migrated to a custom auth system.
 */

import type { SupabaseClient } from './create-client';

// Query builder stub with full chaining support
interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  ilike(column: string, value: string): QueryBuilder;
  eq(column: string, value: any): QueryBuilder;
  limit(count: number): QueryBuilder;
  range(start: number, end: number): QueryBuilder;
  order(column: string, options?: any): Promise<{ data: any[]; error: any }>;
  single(): Promise<{ data: any; error: any }>;
  then(onfulfilled: any, onrejected: any): any;
}

function createQueryBuilder(): QueryBuilder {
  const query: any = {
    select: (columns?: string) => createQueryBuilder(),
    ilike: (column: string, value: string) => createQueryBuilder(),
    eq: (column: string, value: any) => createQueryBuilder(),
    limit: (count: number) => createQueryBuilder(),
    range: (start: number, end: number) => createQueryBuilder(),
    order: async (column: string, options?: any) => ({ data: [], error: null }),
    single: async () => ({ data: null, error: null }),
  };
  
  // Make it thenable to handle .select().single() patterns
  query.then = function(onfulfilled: any, onrejected: any) {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  };
  
  return query;
}

// Channel stub with presence support
interface Channel {
  on(event: string, filter: any, callback: any): {
    subscribe: (cb: any) => { status: string };
  };
  presenceState(): Record<string, any>;
  track(data: any): Promise<void>;
}

function createChannel(name: string, options?: any): Channel {
  return {
    on: (event: string, filter: any, callback: any) => ({
      subscribe: (cb: any) => ({
        status: 'SUBSCRIBED',
      }),
    }),
    presenceState: () => ({}),
    track: async (data: any) => {},
  };
}

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
    channel: ((name: string, options?: any) => createChannel(name, options)) as any,
    removeChannel: () => {},
    from: (table: string) => createQueryBuilder() as any,
  };
}
export const getSupabaseClient = createClient;

export default createClient;
export type { SupabaseClient };
