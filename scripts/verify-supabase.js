#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL before running this script.');
  }
  return url;
}

function getServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.');
  }
  return key;
}

const REQUIRED_TABLES = [
  'users',
  'wallet_transactions',
  'categories',
  'products',
  'product_variants',
  'orders',
  'order_items',
  'inventory_items',
  'topup_requests',
  'bank_accounts',
  'notifications_log'
];

const REQUIRED_FUNCTIONS = [
  'record_wallet_transaction',
  'create_order',
  'approve_topup',
  'reject_topup'
];

async function fetchExistingTables(client) {
  const { data, error } = await client
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', REQUIRED_TABLES);
  if (error) {
    throw new Error(`Failed to read table metadata: ${error.message}`);
  }
  return (data ?? []).map((row) => row.table_name);
}

async function fetchExistingFunctions(client) {
  const { data, error } = await client
    .from('information_schema.routines')
    .select('routine_name')
    .eq('specific_schema', 'public')
    .in('routine_name', REQUIRED_FUNCTIONS);
  if (error) {
    throw new Error(`Failed to read routine metadata: ${error.message}`);
  }
  return (data ?? []).map((row) => row.routine_name);
}

async function ensureExtension(client, name) {
  const { data, error } = await client
    .schema('pg_catalog')
    .from('pg_extension')
    .select('extname')
    .eq('extname', name)
    .limit(1);
  if (error) {
    throw new Error(`Failed to confirm ${name} extension: ${error.message}`);
  }
  return data.length > 0;
}

async function main() {
  try {
    const client = createClient(getSupabaseUrl(), getServiceKey(), {
      auth: { persistSession: false }
    });

    const [tables, functions, hasPgcrypto] = await Promise.all([
      fetchExistingTables(client),
      fetchExistingFunctions(client),
      ensureExtension(client, 'pgcrypto')
    ]);

    const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));
    const missingFunctions = REQUIRED_FUNCTIONS.filter((fn) => !functions.includes(fn));

    if (!hasPgcrypto) {
      console.error('✗ pgcrypto extension is not enabled. Rerun the schema.sql script.');
      process.exitCode = 1;
    }

    if (missingTables.length > 0) {
      console.error('✗ Missing tables:', missingTables.join(', '));
      process.exitCode = 1;
    }

    if (missingFunctions.length > 0) {
      console.error('✗ Missing stored functions:', missingFunctions.join(', '));
      process.exitCode = 1;
    }

    if (process.exitCode) {
      console.error('Supabase schema verification failed.');
    } else {
      console.log('✓ Supabase schema looks good. All required tables and functions are present.');
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
