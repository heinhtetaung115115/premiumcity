'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Copy, Bell } from 'lucide-react';

type OrdersListClientProps = {
  orders: any[];
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function getFlagEmoji(country: string | null | undefined) {
  if (!country) return '🌐';
  const cRaw = country.trim();
  const cUpper = cRaw.toUpperCase();

  // Explicit mapping for codes
  const CODE_MAP: Record<string, string> = {
    SG: '🇸🇬',
    JP: '🇯🇵',
    TH: '🇹🇭',
  };

  // Explicit mapping for full names
  const NAME_MAP: Record<string, string> = {
    SINGAPORE: '🇸🇬',
    JAPAN: '🇯🇵',
    THAILAND: '🇹🇭',
  };

  if (CODE_MAP[cUpper]) return CODE_MAP[cUpper];
  if (NAME_MAP[cUpper]) return NAME_MAP[cUpper];

  // Generic ISO-2 -> emoji
  if (cUpper.length === 2 && /^[A-Z]{2}$/.test(cUpper)) {
    const codePoints = [...cUpper].map(
      (ch) => 0x1f1e6 + ch.charCodeAt(0) - 65
    );
    return String.fromCodePoint(...codePoints);
  }

  return '🌐';
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500"
    >
      <Copy className="h-3.5 w-3.5" />
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function CredentialsBlock({ credentials }: { credentials: any[] }) {
  if (!credentials || credentials.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
        Delivered access
      </p>

      <div className="space-y-2">
        {credentials.map((cred, idx) => {
          const c = cred || {};
          const entries = Object.entries(c) as [string, any][];

          if (!entries.length) return null;

          return (
            <div key={idx} className="rounded-lg bg-slate-950/80 px-3 py-2">
              <p className="mb-1 text-[11px] text-slate-500">
                Credential #{idx + 1}
              </p>

              <div className="space-y-2">
                {entries.map(([key, value]) => {
                  if (value == null || value === '') return null;

                  const isNote =
                    ['note', 'remark', 'remarks', 'comment'].includes(
                      key.toLowerCase()
                    );

                  const displayValue = String(value);

                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] uppercase text-slate-500">
                          {key}
                        </span>
                        <p className="break-all text-sm text-emerald-100">
                          {displayValue}
                        </p>
                      </div>

                      {!isNote && (
                        <div className="flex-shrink-0">
                          <CopyButton value={displayValue} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrdersListClient({ orders }: OrdersListClientProps) {
  const [hasNotificationSupport, setHasNotificationSupport] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission | 'default'>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Detect Notification support on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      setHasNotificationSupport(true);
      setPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  async function handleEnableNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setNotificationsEnabled(true);
      }
    } catch {
      // ignore
    }
  }

  // Browser notification for manual orders delivered
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !notificationsEnabled ||
      !('Notification' in window)
    ) {
      return;
    }

    if (Notification.permission !== 'granted') return;

    try {
      const stored = window.localStorage.getItem('pc_notified_orders');
      const seen = new Set<string>(stored ? JSON.parse(stored) : []);

      let changed = false;

      orders.forEach((order: any) => {
        const status = String(order.status || '').toUpperCase();
        const items: any[] = Array.isArray(order.items) ? order.items : [];

        const hasManualDelivered = items.some((item) => {
          const type = String(
            item.productType || item.product_type || ''
          ).toUpperCase();
          const creds = Array.isArray(item.credentials)
            ? item.credentials
            : [];
          return type === 'MANUAL' && creds.length > 0;
        });

        if (
          status === 'COMPLETED' &&
          hasManualDelivered &&
          !seen.has(order.id)
        ) {
          new Notification('Your PremiumCity order is ready', {
            body: `Order ${order.id} has been delivered. You can now view your access details in the Orders page.`,
            tag: `premiumcity-order-${order.id}`,
          });
          seen.add(order.id);
          changed = true;
        }
      });

      if (changed) {
        window.localStorage.setItem(
          'pc_notified_orders',
          JSON.stringify(Array.from(seen))
        );
      }
    } catch {
      // ignore
    }
  }, [orders, notificationsEnabled]);

  return (
    <div className="space-y-4">
      {/* Notification toggle / status */}
      {hasNotificationSupport && (
        <div className="mb-1 flex items-center justify-end gap-2 text-[11px] text-slate-500">
          <Bell
            className={`h-3.5 w-3.5 ${
              notificationsEnabled && permission === 'granted'
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          />
          {permission === 'granted' ? (
            <span>Browser notifications enabled for delivered orders</span>
          ) : permission === 'denied' ? (
            <span>Notifications blocked in browser settings</span>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-500"
            >
              Enable order notifications
            </button>
          )}
        </div>
      )}

      {orders.map((order: any) => {
        const createdAt = formatDate(order.createdAt || order.created_at);
        const statusRaw = (order.status || '').toString();
        const statusUpper = statusRaw.toUpperCase();
        const total = Number(order.totalAmount ?? order.total_amount ?? 0);
        const totalDisplay = `${total.toLocaleString('en-US')} Ks`;

        const items: any[] = Array.isArray(order.items) ? order.items : [];

        return (
          <Card
            key={order.id}
            className="border-slate-800 bg-slate-950/70"
          >
            <div className="p-4">
              <details className="group">
                {/* SUMMARY HEADER */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Order ID</p>
                    <p className="font-mono text-sm text-slate-100">
                      {order.id}
                    </p>
                    <p className="text-xs text-slate-500">{createdAt}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="space-y-1 text-right">
                      <p className="text-sm font-semibold text-slate-50">
                        {totalDisplay}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-md border border-emerald-600/40 bg-emerald-700/30 px-3 py-1 text-[11px] text-emerald-200 group-open:hidden">
                        Tap to view order
                      </span>
                      <span className="hidden rounded-md border border-slate-600/40 bg-slate-700/40 px-3 py-1 text-[11px] text-slate-200 group-open:inline-flex">
                        Hide order
                      </span>
                    </div>
                  </div>
                </summary>

                {/* ORDER DETAILS */}
                {items.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-slate-800 pt-3 transition-all duration-200 group-open:opacity-100">
                    {items.map((item, idx) => {
                      const qty = Number(item.quantity ?? 1);
                      const productName =
                        item.productName || item.product_name || 'Product';
                      const variantName =
                        item.variantName || item.variant_name || null;
                      const productType =
                        item.productType || item.product_type || 'INSTANT';

                      const isManual =
                        String(productType).toUpperCase() === 'MANUAL';

                      const manualInput = item.manualInput || null;
                      const credentials: any[] = Array.isArray(
                        item.credentials
                      )
                        ? item.credentials
                        : [];
                      const hasCreds = credentials.length > 0;

                      // VPN extras
                      const vpnCountry =
                        item.vpnCountry || item.vpn_country || null;
                      const vpnPlanName =
                        item.vpnPlanName || item.vpn_plan_name || null;
                      const vpnExpiresAt =
                        item.vpnExpiresAt || item.vpn_expires_at || null;
                      const vpnDataLimitBytes =
                        item.vpnDataLimitBytes ?? item.vpn_data_limit_bytes;
                      const vpnUsedBytes =
                        item.vpnUsedBytes ?? item.vpn_used_bytes ?? 0;
                      const vpnSsUri = item.vpnSsUri || item.vpn_ss_uri || null;

                      const vpnKeys: any[] = Array.isArray(item.vpnKeys)
                        ? item.vpnKeys
                        : [];

                      // Fallback: if server didn't send vpnKeys but we do have one vpnSsUri, create a single key entry
                      const allVpnKeys =
                        vpnKeys.length > 0
                          ? vpnKeys
                          : vpnSsUri
                          ? [
                              {
                                ssUri: vpnSsUri,
                                country: vpnCountry,
                                planName: vpnPlanName,
                                expiresAt: vpnExpiresAt,
                                dataLimitBytes: vpnDataLimitBytes,
                                usedBytes: vpnUsedBytes,
                              },
                            ]
                          : [];

                      const primaryKey = allVpnKeys[0] || null;

                      const isVpn =
                        allVpnKeys.length > 0 ||
                        Boolean(vpnSsUri || vpnDataLimitBytes || vpnUsedBytes);

                      const primarySs =
                        typeof primaryKey?.ssUri === 'string'
                          ? primaryKey.ssUri
                          : typeof vpnSsUri === 'string'
                          ? vpnSsUri
                          : null;

                      const shortKeyDisplay =
                        typeof primarySs === 'string'
                          ? primarySs.length > 40
                            ? primarySs.slice(0, 40) + '…'
                            : primarySs
                          : '';

                      return (
                        <div
                          key={item.id || idx}
                          className="rounded-xl bg-slate-900/80 px-3 py-2"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-100">
                              {productName}{' '}
                              {variantName && (
                                <span className="text-xs text-slate-400">
                                  · {variantName}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {isManual && !isVpn
                                ? 'Manual delivery'
                                : 'Instant delivery'}
                              {' · '}Qty {qty}
                            </p>
                          </div>

                          {/* User submitted details (manual orders) */}
                          {isManual &&
                            !isVpn &&
                            manualInput &&
                            Object.keys(manualInput).length > 0 && (
                              <div className="mt-2 rounded-lg bg-slate-950/70 p-2 text-[11px] text-slate-300">
                                <p className="mb-1 font-semibold text-slate-200">
                                  Your submitted details
                                </p>
                                <ul className="space-y-0.5">
                                  {Object.entries(manualInput).map(
                                    ([k, v]) => {
                                      const rawValue = String(v ?? '');

                                      let display = rawValue;
                                      const lastColon =
                                        rawValue.lastIndexOf(':');
                                      if (
                                        lastColon !== -1 &&
                                        lastColon < rawValue.length - 1
                                      ) {
                                        display = rawValue
                                          .slice(lastColon + 1)
                                          .trim();
                                      }

                                      if (!display) return null;

                                      return (
                                        <li key={k}>
                                          <span className="break-all">
                                            {display}
                                          </span>
                                        </li>
                                      );
                                    }
                                  )}
                                </ul>
                              </div>
                            )}

                          {/* VPN OUTLINE BLOCK – per-key usage */}
                          {isVpn && primaryKey && (
                            <div className="mt-3 rounded-xl border border-emerald-600/50 bg-emerald-950/40 p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                                    Your Outline key
                                    {allVpnKeys.length > 1 &&
                                      ` (${allVpnKeys.length} keys)`}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">
                                      {getFlagEmoji(
                                        primaryKey.country || vpnCountry
                                      )}
                                    </span>
                                    <span className="break-all font-mono text-[11px] text-emerald-100 sm:text-xs">
                                      {shortKeyDisplay}
                                    </span>
                                  </div>
                                </div>
                                {primarySs && (
                                  <div className="flex-shrink-0">
                                    <CopyButton value={primarySs} />
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-emerald-100">
                                {(primaryKey.country || vpnCountry) && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/70 px-2 py-0.5">
                                    <span>
                                      {getFlagEmoji(
                                        primaryKey.country || vpnCountry
                                      )}
                                    </span>
                                    <span>
                                      {primaryKey.country || vpnCountry}
                                    </span>
                                  </span>
                                )}
                                {(primaryKey.planName || vpnPlanName) && (
                                  <span className="rounded-full bg-emerald-900/70 px-2 py-0.5">
                                    {primaryKey.planName || vpnPlanName}
                                  </span>
                                )}
                                {(primaryKey.expiresAt || vpnExpiresAt) && (
                                  <span className="rounded-full bg-emerald-900/70 px-2 py-0.5">
                                    Expires{' '}
                                    {formatDateOnly(
                                      primaryKey.expiresAt ||
                                        vpnExpiresAt
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Per-key usage list */}
                              <div className="mt-4 space-y-3">
                                {allVpnKeys.map((k, i) => {
                                  const limitBytes =
                                    typeof k.dataLimitBytes === 'number'
                                      ? k.dataLimitBytes
                                      : typeof k.data_limit_bytes ===
                                        'number'
                                      ? k.data_limit_bytes
                                      : null;

                                  const usedBytes =
                                    typeof k.usedBytes === 'number'
                                      ? k.usedBytes
                                      : typeof k.used_bytes === 'number'
                                      ? k.used_bytes
                                      : 0;

                                  let limitGb: number | null = null;
                                  let usedGb = 0;
                                  let percentUsed = 0;

                                  if (typeof limitBytes === 'number') {
                                    limitGb = limitBytes / 1_000_000_000;
                                  }

                                  if (typeof usedBytes === 'number') {
                                    usedGb = usedBytes / 1_000_000_000;
                                  }

                                  if (limitGb && limitGb > 0) {
                                    percentUsed = Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        (usedGb / limitGb) * 100
                                      )
                                    );
                                  }

                                  const label =
                                    typeof k.ssUri === 'string'
                                      ? k.ssUri.length > 60
                                        ? k.ssUri.slice(0, 60) + '…'
                                        : k.ssUri
                                      : '';

                                  return (
                                    <div
                                      key={k.id || i}
                                      className="space-y-2 rounded-xl bg-slate-950/80 p-3"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-emerald-200">
                                            KEY #{i + 1}
                                          </p>
                                          {label && (
                                            <p className="mt-0.5 break-all font-mono text-[11px] text-emerald-100">
                                              {label}
                                            </p>
                                          )}
                                        </div>
                                        {k.ssUri && (
                                          <CopyButton value={k.ssUri} />
                                        )}
                                      </div>
                                      {limitGb !== null && (
                                        <div className="space-y-1.5">
                                          <div className="flex justify-between text-[11px] text-emerald-200">
                                            <span>Usage</span>
                                            <span>
                                              {usedGb.toFixed(2)} /{' '}
                                              {Math.round(limitGb)} GB
                                            </span>
                                          </div>
                                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/40">
                                            <div
                                              className="h-full rounded-full bg-emerald-400"
                                              style={{
                                                width: `${percentUsed}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* CREDENTIALS (for instant/manual non-VPN stuff) */}
                          {!isVpn && hasCreds && (
                            <CredentialsBlock credentials={credentials} />
                          )}

                          {/* PENDING MANUAL DELIVERY BOX (non VPN only) */}
                          {isManual &&
                            !isVpn &&
                            !hasCreds &&
                            statusUpper !== 'CANCELLED' && (
                              <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3">
                                <span className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-400" />
                                <div className="space-y-1 text-xs text-amber-100">
                                  <p className="font-semibold">
                                    Manual delivery in progress
                                  </p>
                                  <p>
                                    We received your order and will deliver your
                                    access as soon as possible. Once we finish
                                    delivery, we will update your login details
                                    here.
                                  </p>
                                  <p className="text-amber-200">
                                    Typical delivery time:{' '}
                                    <span className="font-semibold">
                                      15 minutes – 8 hours
                                    </span>{' '}
                                    after your payment is confirmed.
                                  </p>
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
