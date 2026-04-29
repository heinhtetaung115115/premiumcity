import { getAnonSupabaseClient } from './supabase';
import type { SupabaseClient } from './supabase';

// Re-export a simple anon Supabase client for server components
export const supabase: SupabaseClient = getAnonSupabaseClient();
