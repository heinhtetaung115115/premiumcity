const REST_ENDPOINT = '/rest/v1';

type QueryResponse<T = unknown> = {
  data: T | null;
  error: Error | null;
};

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'in'; column: string; values: unknown[] };

type Order = { column: string; ascending: boolean };

type RequestOptions = {
  table: string;
  method: 'GET' | 'POST';
  select?: string | null;
  filters?: Filter[];
  orders?: Order[];
  limit?: number;
  body?: unknown;
  schema?: string;
  single?: 'single' | 'maybe';
};

function ensureUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Supabase URL is not configured');
  }
  return url.replace(/\/$/, '');
}

function encodeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return encodeURIComponent(value);
  }
  return encodeURIComponent(String(value));
}

async function parseError(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      if (payload && typeof payload === 'object' && 'message' in payload) {
        return (payload as { message?: string }).message ?? response.statusText;
      }
      return JSON.stringify(payload);
    }
    const text = await response.text();
    return text || response.statusText;
  } catch (error) {
    return (error as Error).message || response.statusText;
  }
}

class SupabaseRestClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = ensureUrl();
    this.apiKey = apiKey;
  }

  from(table: string, schema?: string) {
    const self = this;
    return {
      select(columns: string) {
        return new SupabaseSelectQuery(self, table, columns, schema);
      },
      insert(values: unknown) {
        return new SupabaseInsertQuery(self, table, values, schema);
      }
    };
  }

  rpc(functionName: string, args?: Record<string, unknown>): Promise<QueryResponse> {
    const url = `${this.baseUrl}${REST_ENDPOINT}/rpc/${functionName}`;
    const headers: Record<string, string> = {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args ?? {})
    }).then(async (response) => {
      if (!response.ok) {
        const message = await parseError(response);
        return { data: null, error: new Error(message || 'Supabase RPC request failed') };
      }
      if (response.status === 204) {
        return { data: null, error: null };
      }
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      return { data, error: null };
    });
  }

  request(options: RequestOptions): Promise<QueryResponse> {
    const url = new URL(`${this.baseUrl}${REST_ENDPOINT}/${options.table}`);

    if (options.select) {
      url.searchParams.set('select', options.select);
    }

    for (const filter of options.filters ?? []) {
      if (filter.type === 'eq') {
        url.searchParams.append(filter.column, `eq.${encodeValue(filter.value)}`);
      } else if (filter.type === 'in') {
        const encoded = filter.values.map((value) => encodeValue(value)).join(',');
        url.searchParams.append(filter.column, `in.(${encoded})`);
      }
    }

    for (const order of options.orders ?? []) {
      url.searchParams.append('order', `${order.column}.${order.ascending ? 'asc' : 'desc'}`);
    }

    if (typeof options.limit === 'number') {
      url.searchParams.set('limit', String(options.limit));
    }

    const headers: Record<string, string> = {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json'
    };

    if (options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['Prefer'] = 'return=representation';
    }

    if (options.schema && options.schema !== 'public') {
      headers['Accept-Profile'] = options.schema;
      if (options.method !== 'GET') {
        headers['Content-Profile'] = options.schema;
      }
    }

    return fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.method === 'GET' ? undefined : JSON.stringify(options.body)
    }).then(async (response) => {
      if (!response.ok) {
        const message = await parseError(response);
        return { data: null, error: new Error(message || 'Supabase request failed') };
      }

      if (response.status === 204) {
        return { data: null, error: null };
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (options.single) {
        if (Array.isArray(data)) {
          if (data.length === 0) {
            if (options.single === 'single') {
              return { data: null, error: new Error('Row not found') };
            }
            return { data: null, error: null };
          }
          if (data.length > 1 && options.single === 'single') {
            return { data: null, error: new Error('Multiple rows returned when single row expected') };
          }
          return { data: data[0] ?? null, error: null };
        }
        return { data, error: null };
      }

      return { data, error: null };
    });
  }
}

class SupabaseSelectQuery implements PromiseLike<QueryResponse> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitValue: number | undefined;
  private execution: Promise<QueryResponse> | null = null;
  private singleMode: 'single' | 'maybe' | undefined;

  constructor(
    private client: SupabaseRestClient,
    private table: string,
    private columns: string,
    private schema?: string
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this.execute();
  }

  single() {
    this.singleMode = 'single';
    return this.execute();
  }

  private execute() {
    if (!this.execution) {
      this.execution = this.client.request({
        table: this.table,
        method: 'GET',
        select: this.columns,
        filters: this.filters,
        orders: this.orders,
        limit: this.limitValue,
        schema: this.schema,
        single: this.singleMode
      });
    }
    return this.execution;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) {
    return this.execute().catch(onrejected as any);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }
}

class SupabaseInsertQuery implements PromiseLike<QueryResponse> {
  private returningColumns: string | null = null;
  private singleMode: 'single' | 'maybe' | undefined;
  private execution: Promise<QueryResponse> | null = null;

  constructor(
    private client: SupabaseRestClient,
    private table: string,
    private values: unknown,
    private schema?: string
  ) {}

  select(columns: string) {
    this.returningColumns = columns;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this.execute();
  }

  single() {
    this.singleMode = 'single';
    return this.execute();
  }

  private execute() {
    if (!this.execution) {
      const body = Array.isArray(this.values) ? this.values : [this.values];
      this.execution = this.client.request({
        table: this.table,
        method: 'POST',
        select: this.returningColumns,
        body,
        schema: this.schema,
        single: this.singleMode
      });
    }
    return this.execution;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) {
    return this.execute().catch(onrejected as any);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }
}

let cachedServiceClient: SupabaseRestClient | null = null;
let cachedAnonClient: SupabaseRestClient | null = null;

function getSupabaseServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return key;
}

function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured');
  }
  return key;
}

export type SupabaseClient = {
  from: SupabaseRestClient['from'];
  rpc: SupabaseRestClient['rpc'];
};

export function getServiceSupabaseClient(): SupabaseClient {
  if (!cachedServiceClient) {
    cachedServiceClient = new SupabaseRestClient(getSupabaseServiceKey());
  }
  return cachedServiceClient;
}

export function getAnonSupabaseClient(): SupabaseClient {
  if (!cachedAnonClient) {
    cachedAnonClient = new SupabaseRestClient(getSupabaseAnonKey());
  }
  return cachedAnonClient;
}
