// lib/outline.ts
// Small client for the Outline server management API.
// Docs: https://github.com/Jigsaw-Code/outline-server/blob/master/src/shadowbox/server/api.yml
//
// Outline management APIs use a self-signed certificate. Like the rest of the
// app, this relies on NODE_TLS_REJECT_UNAUTHORIZED=0 (set in Vercel env) for
// those calls.

export type OutlineKey = {
  id: string;
  accessUrl: string;
};

export type SsConfig = {
  server: string;
  server_port: number;
  password: string;
  method: string;
};

function base(apiUrl: string): string {
  return String(apiUrl || '').trim().replace(/\/+$/, '');
}

async function call(
  apiUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<Response> {
  const url = base(apiUrl);
  if (!url) throw new Error('Outline server has no API URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${url}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Is the server's management API answering? */
export async function outlinePing(apiUrl: string): Promise<boolean> {
  try {
    const res = await call(apiUrl, '/server', { method: 'GET' }, 6000);
    return res.ok;
  } catch {
    return false;
  }
}

/** Create a key, optionally with a name and a data limit (bytes; <=0 = no limit). */
export async function outlineCreateKey(
  apiUrl: string,
  opts: { name?: string; limitBytes?: number | null } = {}
): Promise<OutlineKey> {
  const res = await call(apiUrl, '/access-keys', { method: 'POST' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Outline create key failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const created: any = await res.json();
  const key: OutlineKey = { id: String(created.id), accessUrl: String(created.accessUrl) };

  if (opts.name) {
    try {
      await call(apiUrl, `/access-keys/${encodeURIComponent(key.id)}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: opts.name }),
      });
    } catch {
      /* name is cosmetic */
    }
  }

  if (opts.limitBytes != null && opts.limitBytes > 0) {
    await outlineSetLimit(apiUrl, key.id, opts.limitBytes);
  } else if (opts.limitBytes === 0) {
    // 0 remaining = block traffic until the next data period
    await outlineSetLimit(apiUrl, key.id, 0);
  }

  return key;
}

export async function outlineSetLimit(apiUrl: string, keyId: string, bytes: number): Promise<void> {
  const res = await call(apiUrl, `/access-keys/${encodeURIComponent(keyId)}/data-limit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: { bytes: Math.max(0, Math.floor(bytes)) } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Outline set limit failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Delete a key. A key that's already gone counts as success. */
export async function outlineDeleteKey(apiUrl: string, keyId: string): Promise<boolean> {
  try {
    const res = await call(apiUrl, `/access-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Bytes used per Outline key id (Outline counts the last 30 days). */
export async function outlineGetTransfer(apiUrl: string, timeoutMs = 10000): Promise<Record<string, number>> {
  const res = await call(apiUrl, '/metrics/transfer', { method: 'GET' }, timeoutMs);
  if (!res.ok) throw new Error(`Outline metrics failed (${res.status})`);
  const json: any = await res.json().catch(() => null);
  const map =
    json?.bytesTransferredByUserId ??
    json?.bytes_transferred_by_user_id ??
    json?.metrics?.bytesTransferredByUserId ??
    {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[String(k)] = Number(v) || 0;
  return out;
}

/**
 * Parse an ss:// access URL into the JSON shape used by dynamic access keys.
 * Format: ss://base64url(method:password)@host:port/?outline=1#tag
 */
export function parseSsUri(ssUri: string | null | undefined): SsConfig | null {
  if (!ssUri || !ssUri.startsWith('ss://')) return null;
  try {
    const withoutScheme = ssUri.slice(5).split('#')[0];
    const at = withoutScheme.lastIndexOf('@');
    if (at < 0) return null;
    const userInfo = decodeURIComponent(withoutScheme.slice(0, at));
    const hostPart = withoutScheme.slice(at + 1).split('/')[0].split('?')[0];

    let decoded: string;
    if (userInfo.includes(':')) {
      decoded = userInfo; // plain method:password (SIP002 allows this)
    } else {
      const b64 = userInfo.replace(/-/g, '+').replace(/_/g, '/');
      decoded = Buffer.from(b64, 'base64').toString('utf8');
    }
    const colon = decoded.indexOf(':');
    if (colon < 0) return null;

    const portSep = hostPart.lastIndexOf(':');
    if (portSep < 0) return null;
    let host = hostPart.slice(0, portSep);
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1); // IPv6
    const port = Number(hostPart.slice(portSep + 1));
    if (!host || !Number.isFinite(port)) return null;

    return {
      server: host,
      server_port: port,
      method: decoded.slice(0, colon),
      password: decoded.slice(colon + 1),
    };
  } catch {
    return null;
  }
}
