/**
 * Supabase pgvector Integration
 *
 * Exports all Supabase-related modules for easy importing.
 */

// Supabase Client
export {
  getSupabaseClient,
  getSupabaseAdminClient,
  getSupabaseDatabase,
  SupabaseDatabase,
  type SupabaseEnv,
  type QueryResult,
  type UserEmbeddingRecord,
  type ProductSearchRecord,
  type OrderSearchRecord,
} from './client';

// Hybrid Search
export {
  hybridSearch,
  searchProducts,
  searchWithPreferences,
  searchOrders,
  type HybridSearchResult,
  type SearchOptions,
  type SearchResponse,
  type SearchContext,
} from './search/hybrid';

// User Preferences
export {
  generateQueryEmbedding,
  storePreference,
  storePreferencesBatch,
  getSimilarPreferences,
  getUserPreferences,
  updatePreferencesFromContext,
  consolidateUserPreferences,
  cleanupOldPreferences,
  getPreferenceStats,
  validateEmbedding,
  getEmbeddingConfig,
  type PreferenceContextType,
  type EmbeddingResult,
  type PreferenceResult,
  type PreferenceQueryResult,
  type ConversationContext,
} from './services/user-prefs';
