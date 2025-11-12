#!/usr/bin/env node

const REST_ENDPOINT = '/rest/v1';

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL before running this script.');
  }
  return url.replace(/\/$/, '');
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

function encodeValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return encodeURIComponent(value);
  }
  return encodeURIComponent(String(value));
}

async function restSelect({ table, columns, schema = 'public', filters = [], limit }) {
  const baseUrl = getSupabaseUrl();
  const apiKey = getServiceKey();
  const url = new URL(`${baseUrl}${REST_ENDPOINT}/${table}`);

  url.searchParams.set('select', columns);

  for (const filter of filters) {
    if (filter.type === 'eq') {
      url.searchParams.append(filter.column, `eq.${encodeValue(filter.value)}`);
    } else if (filter.type === 'in') {
      const encoded = filter.values.map((value) => encodeValue(value)).join(',');
      url.searchParams.append(filter.column, `in.(${encoded})`);
    }
  }

  if (typeof limit === 'number') {
    url.searchParams.set('limit', String(limit));
  }

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json'
  };

  if (schema !== 'public') {
    headers['Accept-Profile'] = schema;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to query ${table}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function fetchExistingTables() {
  const rows = await restSelect({
    table: 'tables',
    schema: 'information_schema',
    columns: 'table_name',
    filters: [
      { type: 'eq', column: 'table_schema', value: 'public' },
      { type: 'in', column: 'table_name', values: REQUIRED_TABLES }
    ]
  });
  return rows.map((row) => row.table_name);
}

async function fetchExistingFunctions() {
  const rows = await restSelect({
    table: 'routines',
    schema: 'information_schema',
    columns: 'routine_name',
    filters: [
      { type: 'eq', column: 'specific_schema', value: 'public' },
      { type: 'in', column: 'routine_name', values: REQUIRED_FUNCTIONS }
    ]
  });
  return rows.map((row) => row.routine_name);
}

async function ensureExtension(name) {
  const rows = await restSelect({
    table: 'pg_extension',
    schema: 'pg_catalog',
    columns: 'extname',
    filters: [{ type: 'eq', column: 'extname', value: name }],
    limit: 1
  });
  return rows.length > 0;
}

async function main() {
  try {
    const [tables, functions, hasPgcrypto] = await Promise.all([
      fetchExistingTables(),
      fetchExistingFunctions(),
      ensureExtension('pgcrypto')
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
