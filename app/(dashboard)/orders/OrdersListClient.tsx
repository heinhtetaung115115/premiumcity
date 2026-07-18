'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Copy, Bell } from 'lucide-react';
import { credentialToRows } from '@/lib/deliveryTypes';
import { NetflixPanel } from './NetflixPanel';

type OrdersListClientProps = {
  orders: any[];
  page?: number;
  totalPages?: number;
  total?: number;
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

function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    // Prevent the <summary> from toggling the details open/closed
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
    >
      <Copy className="h-3 w-3" />
      <span>{copied ? 'Copied' : 'Copy ID'}</span>
    </button>
  );
}

function CredentialsBlock({ credentials }: { credentials: any[] }) {
  if (!credentials || credentials.length === 0) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-700/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.7 7.7l-5.4 5.4a1 1 0 01-1.4 0l-2.6-2.6a1 1 0 011.4-1.4l1.9 1.9 4.7-4.7a1 1 0 011.4 1.4z" />
        </svg>
        <span className="text-xs font-semibold text-emerald-200">Your account is ready</span>
      </div>

      <div className="space-y-3">
        {credentials.map((cred, idx) => {
          const rows = credentialToRows(cred);
          if (!rows.length) return null;

          return (
            <div key={idx} className="space-y-2">
              {credentials.length > 1 && (
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Account #{idx + 1}
                </p>
              )}

              {rows.map((row) => (
                <div key={row.label}>
                  <p className="mb-1 text-[9px] uppercase tracking-[0.05em] text-slate-500">
                    {row.label}
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <span className="min-w-0 break-all font-mono text-[13px] text-slate-100">
                      {row.value}
                    </span>
                    {row.copyable && (
                      <div className="flex-shrink-0">
                        <CopyButton value={row.value} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        ⚠ Please don&apos;t change the account password. If it stops working, copy your Order ID above and contact support.
      </p>
    </div>
  );
}

function getStatusBadge(statusUpper: string, isPreparing: boolean) {
  if (statusUpper === 'COMPLETED') {
    return { label: 'COMPLETED', badgeClass: 'bg-emerald-900/60 text-emerald-300' };
  }
  if (statusUpper === 'CANCELLED') {
    return { label: 'CANCELLED', badgeClass: 'bg-rose-900/60 text-rose-300' };
  }
  if (isPreparing) {
    return { label: 'PREPARING', badgeClass: 'bg-amber-900/60 text-amber-300' };
  }
  return { label: statusUpper || 'PENDING', badgeClass: 'bg-slate-700/60 text-slate-300' };
}

export function OrdersListClient({ orders, page = 1, totalPages = 1, total = 0 }: OrdersListClientProps) {
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

        // Smart hybrid: auto-expand orders that are still being prepared
        // (manual, not cancelled, no credentials delivered yet) so the customer
        // sees the tracker without tapping. Completed orders stay collapsed.
        const anyManualPending = items.some((item) => {
          const type = String(item.productType || item.product_type || '').toUpperCase();
          const creds = Array.isArray(item.credentials) ? item.credentials : [];
          const vpnKeys = Array.isArray(item.vpnKeys) ? item.vpnKeys : [];
          return type === 'MANUAL' && creds.length === 0 && vpnKeys.length === 0;
        });
        const autoOpen = anyManualPending && statusUpper !== 'CANCELLED' && statusUpper !== 'COMPLETED';

        const shortId = String(order.id).slice(0, 8);

        // Header info from the first item
        const firstItem = items[0] || {};
        const headerName =
          firstItem.productName || firstItem.product_name || 'Order';
        const itemCount = items.length;

        // Status badge styling
        const badge = getStatusBadge(statusUpper, anyManualPending);

        return (
          <Card
            key={order.id}
            className="overflow-hidden border-slate-600/50 bg-[#232d42] p-0"
          >
            <details className="group" open={autoOpen}>
              <summary className="cursor-pointer list-none p-4">
                {/* Top row: icon + name + status */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#2f3d5c] text-emerald-300">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M9 9l4 3-4 3V9z" fill="currentColor" stroke="none" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-50">
                        {headerName}
                        {itemCount > 1 && (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            +{itemCount - 1} more
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">{createdAt}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Order ID row */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Order ID</span>
                    <span className="font-mono text-[11px] text-slate-200">{shortId}</span>
                  </div>
                  <CopyIdButton value={String(order.id)} />
                </div>

                {/* Divider + hint + total */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-600/40 pt-3">
                  <span className="text-[11px] text-emerald-300 group-open:hidden">
                    View order details ▾
                  </span>
                  <span className="hidden text-[11px] text-slate-400 group-open:inline">
                    Hide ▴
                  </span>
                  <span className="text-sm font-semibold text-slate-50">
                    {totalDisplay}
                  </span>
                </div>
              </summary>

              {/* ORDER DETAILS */}
              <div className="px-4 pb-4">
                {items.length > 0 && (
                  <div className="space-y-3 border-t border-slate-600/40 pt-3 transition-all duration-200 group-open:opacity-100">
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
                            (() => {
                              const isNetflix = credentials.some(
                                (c: any) => c && c.type === 'netflix_panel'
                              );
                              return isNetflix ? (
                                <NetflixPanel orderItemId={item.id} />
                              ) : (
                                <CredentialsBlock credentials={credentials} />
                              );
                            })()
                          )}

                          {/* PENDING MANUAL DELIVERY BOX (non VPN only) */}
                          {isManual &&
                            !isVpn &&
                            !hasCreds &&
                            statusUpper !== 'CANCELLED' && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-4">
                                {/* Animated header */}
                                <div className="flex items-center gap-3">
                                  <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
                                    <div
                                      className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400"
                                      style={{
                                        animation: 'pc-spin 1.5s linear infinite',
                                      }}
                                    />
                                    <span className="text-lg">📦</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-emerald-100">
                                      We&apos;re preparing your order
                                    </p>
                                    <p className="text-[11px] text-emerald-400/60">
                                      Order received • In progress
                                    </p>
                                  </div>
                                </div>

                                {/* Progress steps with connected vertical line */}
                                <div className="relative mt-5 ml-1.5">
                                  {/* Vertical connector line */}
                                  <div
                                    className="absolute left-[9px] top-[20px] w-[2px]"
                                    style={{ height: 'calc(100% - 20px)' }}
                                  >
                                    {/* Completed segment (step 1 to step 2) */}
                                    <div className="h-1/2 w-full bg-emerald-500/60" />
                                    {/* Pending segment (step 2 to step 3) */}
                                    <div className="h-1/2 w-full bg-slate-700/50" style={{
                                      backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 3px, rgb(51 65 85 / 0.5) 3px, rgb(51 65 85 / 0.5) 6px)',
                                      backgroundColor: 'transparent',
                                    }} />
                                  </div>

                                  {/* Step 1: Payment confirmed - completed */}
                                  <div className="relative flex items-center gap-3 pb-5">
                                    <div className="z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30">
                                      <svg className="h-3 w-3 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                    <p className="text-xs text-emerald-300">
                                      Payment confirmed &amp; order received
                                    </p>
                                  </div>

                                  {/* Step 2: Preparing - in progress */}
                                  <div className="relative flex items-center gap-3 pb-5">
                                    <div className="z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-400 bg-slate-900 shadow-sm shadow-emerald-400/20">
                                      <span
                                        className="h-2 w-2 rounded-full bg-emerald-400"
                                        style={{
                                          animation: 'pc-pulse 1.5s ease-in-out infinite',
                                        }}
                                      />
                                    </div>
                                    <p className="text-xs font-medium text-emerald-200">
                                      Preparing your product...
                                    </p>
                                  </div>

                                  {/* Step 3: Delivery - pending */}
                                  <div className="relative flex items-center gap-3">
                                    <div className="z-10 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900">
                                      <span className="h-2 w-2 rounded-full bg-slate-600" />
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      Deliver to your account
                                    </p>
                                  </div>
                                </div>

                                {/* Info note */}
                                <div className="mt-4 rounded-lg bg-slate-950/60 px-3 py-2.5">
                                  <p className="text-[11px] leading-relaxed text-slate-300">
                                    📧 You&apos;ll receive an <span className="font-semibold text-emerald-300">email notification</span> once
                                    your order is delivered. Your login details will
                                    also appear right here.
                                  </p>
                                  <p className="mt-1.5 text-[11px] text-slate-500">
                                    Typical delivery time:{' '}
                                    <span className="font-medium text-slate-400">
                                      15 min – 8 hours
                                    </span>
                                  </p>
                                </div>

                                <style>{`
                                  @keyframes pc-spin {
                                    to { transform: rotate(360deg); }
                                  }
                                  @keyframes pc-pulse {
                                    0%, 100% { opacity: 1; transform: scale(1); }
                                    50% { opacity: 0.3; transform: scale(0.6); }
                                  }
                                `}</style>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          </Card>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1.5 pt-2">
          <PageLink page={page - 1} disabled={page <= 1} label="‹" />
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-slate-600">
                …
              </span>
            ) : (
              <PageLink key={p} page={p as number} active={p === page} label={String(p)} />
            )
          )}
          <PageLink page={page + 1} disabled={page >= totalPages} label="›" />
        </nav>
      )}

      {total > 0 && (
        <p className="pb-2 text-center text-[11px] text-slate-600">
          Page {page} of {totalPages} · {total} order{total === 1 ? '' : 's'} total
        </p>
      )}
    </div>
  );
}

/** Build a compact page list like [1, '...', 4, 5, 6, '...', 12]. */
function getPageNumbers(current: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const push = (n: number | string) => pages.push(n);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
    return pages;
  }
  push(1);
  if (current > 3) push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) push(i);
  if (current < totalPages - 2) push('...');
  push(totalPages);
  return pages;
}

function PageLink({
  page,
  label,
  active,
  disabled,
}: {
  page: number;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-sm text-slate-700">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/orders?page=${page}`}
      scroll
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition ${
        active
          ? 'bg-emerald-500 font-semibold text-slate-950'
          : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
      }`}
    >
      {label}
    </Link>
  );
}
