export type DeliveryType = 'EMAIL_PASSWORD' | 'KEY' | 'INVITE_LINK' | 'NOTE' | 'NETFLIX_PANEL';

export const DELIVERY_TYPE_OPTIONS: { value: DeliveryType; label: string }[] = [
  { value: 'EMAIL_PASSWORD', label: 'Email : Password' },
  { value: 'KEY', label: 'Key' },
  { value: 'INVITE_LINK', label: 'Invite link' },
  { value: 'NOTE', label: 'Note only' },
  { value: 'NETFLIX_PANEL', label: 'Netflix (supplier link)' },
];

export type CredentialRow = { label: string; value: string; copyable: boolean };

/**
 * Turn a stored `inventory_items.payload` (jsonb) into display rows.
 *
 * Understands the typed shape written by the admin fulfillment form
 * (`{ type: 'key' | 'email_password' | 'invite_link' | 'note', ... }`) as
 * well as older untyped rows (`{ email, password, note }`) delivered before
 * this field existed, so historical orders keep rendering correctly.
 */
export function credentialToRows(payload: Record<string, unknown> | null | undefined): CredentialRow[] {
  if (!payload || typeof payload !== 'object') return [];

  const type = typeof (payload as any).type === 'string' ? (payload as any).type : null;
  const rows: CredentialRow[] = [];

  if (type === 'key') {
    if ((payload as any).key) rows.push({ label: 'Key', value: String((payload as any).key), copyable: true });
    if ((payload as any).note) rows.push({ label: 'Note', value: String((payload as any).note), copyable: false });
    return rows;
  }

  if (type === 'invite_link') {
    if ((payload as any).inviteLink) {
      rows.push({ label: 'Invite link', value: String((payload as any).inviteLink), copyable: true });
    }
    if ((payload as any).note) rows.push({ label: 'Note', value: String((payload as any).note), copyable: false });
    return rows;
  }

  if (type === 'netflix_panel') {
    // The live Netflix panel is rendered by a dedicated component that reads
    // the link via the supplier API. This fallback only shows if that path
    // isn't used, so we never expose the raw supplier link as a copyable value.
    if ((payload as any).note) rows.push({ label: 'Note', value: String((payload as any).note), copyable: false });
    return rows;
  }

  if (type === 'note') {
    if ((payload as any).note) rows.push({ label: 'Note', value: String((payload as any).note), copyable: false });
    return rows;
  }

  if (type === 'email_password') {
    if ((payload as any).email) rows.push({ label: 'Email', value: String((payload as any).email), copyable: true });
    if ((payload as any).password) rows.push({ label: 'Password', value: String((payload as any).password), copyable: true });
    if ((payload as any).note) rows.push({ label: 'Note', value: String((payload as any).note), copyable: false });
    return rows;
  }

  // Legacy/unknown shape: render every field generically, skipping the
  // internal "type" marker.
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'type' || value == null || value === '') continue;
    rows.push({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value),
      copyable: !['note', 'remark', 'remarks', 'comment'].includes(key.toLowerCase()),
    });
  }
  return rows;
}
