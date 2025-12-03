import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create the client only if configured
const _supabase: SupabaseClient | null = isSupabaseConfigured && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Export with type assertion - callers must check isSupabaseConfigured first
// Using non-null type to avoid TypeScript narrowing issues in async callbacks
export const supabase = _supabase as SupabaseClient;

// Safe getter that returns null if not configured
export function getSupabase(): SupabaseClient | null {
  return _supabase;
}
