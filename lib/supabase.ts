import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Database = Record<string, never>;

let cachedServiceClient: SupabaseClient<Database> | null = null;
let cachedAnonClient: SupabaseClient<Database> | null = null;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Supabase URL is not configured');
  }
  return url;
}

export function getServiceSupabaseClient() {
  if (cachedServiceClient) {
    return cachedServiceClient;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  cachedServiceClient = createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false }
  });
  return cachedServiceClient;
}

export function getAnonSupabaseClient() {
  if (cachedAnonClient) {
    return cachedAnonClient;
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
  }
  cachedAnonClient = createClient<Database>(getSupabaseUrl(), key);
  return cachedAnonClient;
}
