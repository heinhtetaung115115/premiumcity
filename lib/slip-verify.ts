// lib/slip-verify.ts
import jsQR from 'jsqr';
import sharp from 'sharp';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const ADMIN_ACCOUNTS = [
  { name: 'Hein Htet Aung', lastDigits: '4551' },
];

const AUTO_APPROVE_MAX = 50000;

/**
 * Thrown when the slip-reading AI itself can't be used (missing/invalid key,
 * no credits, rate limit, outage, network). This is OUR problem, not a bad
 * image from the customer, so the caller should fall back to manual review
 * and alert the admin instead of telling the customer their slip is unclear.
 */
export class SlipAiUnavailableError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'SlipAiUnavailableError';
    this.status = status;
  }
}

/** Short human hint for the admin alert, based on the API error. */
export function describeAiFailure(err: SlipAiUnavailableError): string {
  const s = err.status;
  const m = err.message.toLowerCase();
  if (s === null && m.includes('not configured')) return 'ANTHROPIC_API_KEY is not set in Vercel env';
  if (m.includes('credit')) return 'API credit balance is too low — top up credits';
  if (s === 401) return 'API key is invalid or revoked';
  if (s === 403) return 'API key has no permission (account may be disabled)';
  if (s === 429) return 'Rate limited by the API';
  if (s === 529 || (s !== null && s >= 500)) return 'Claude API is down / overloaded';
  if (s === null) return 'Could not reach the Claude API (network error)';
  return `Claude API error ${s}`;
}

// ── QR Scanning ─────────────────────────────────────────

export async function scanQrFromImage(imageBase64: string): Promise<string | null> {
  return (await scanQrFromImageDetailed(imageBase64)).data;
}

/** Like scanQrFromImage, but also reports if the scanner itself crashed. */
export async function scanQrFromImageDetailed(imageBase64: string): Promise<{ data: string | null; error: string | null }> {
  try {
    const buf = Buffer.from(imageBase64, 'base64');

    async function toRgba(pipeline: sharp.Sharp) {
      try {
        const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (info.channels !== 4) return null;
        return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
      } catch { return null; }
    }

    function tryQr(img: { data: Uint8ClampedArray; width: number; height: number } | null): string | null {
      if (!img) return null;
      try {
        const r = jsQR(img.data, img.width, img.height);
        return r?.data ?? null;
      } catch { return null; }
    }

    const meta = await sharp(buf).metadata();
    const origW = meta.width ?? 800;
    const origH = meta.height ?? 1200;

    // Attempt 1: original image
    const r1 = tryQr(await toRgba(sharp(buf)));
    if (r1) return { data: r1, error: null };

    // Attempt 2: normalised
    const r2 = tryQr(await toRgba(sharp(buf).normalise()));
    if (r2) return { data: r2, error: null };

    // Attempt 3: bottom 35% (saved slip / e-receipt format)
    const crop3Top = Math.floor(origH * 0.65);
    const crop3H = origH - crop3Top;
    if (crop3H > 100) {
      const r3 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop3Top, width: origW, height: crop3H }).normalise()));
      if (r3) return { data: r3, error: null };
    }

    // Attempt 4: middle 40-75% region (app screenshot — QR is in middle-bottom area)
    const crop4Top = Math.floor(origH * 0.4);
    const crop4H = Math.floor(origH * 0.35);
    if (crop4H > 100) {
      const r4 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop4Top, width: origW, height: crop4H }).normalise()));
      if (r4) return { data: r4, error: null };
    }

    // Attempt 5: bottom 50% (wider crop for tall phone screenshots)
    const crop5Top = Math.floor(origH * 0.5);
    const crop5H = origH - crop5Top;
    if (crop5H > 100) {
      const r5 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop5Top, width: origW, height: crop5H }).normalise()));
      if (r5) return { data: r5, error: null };
    }

    // Attempt 6: bottom 50% upscaled (small QR in tall screenshot)
    if (crop5H > 100) {
      const r6 = tryQr(await toRgba(
        sharp(buf)
          .extract({ left: 0, top: crop5Top, width: origW, height: crop5H })
          .normalise()
          .resize({ width: Math.max(origW * 2, 1400), withoutEnlargement: false })
      ));
      if (r6) return { data: r6, error: null };
    }

    // Attempt 7: center crop (50-80% height, center 80% width)
    const crop7Top = Math.floor(origH * 0.5);
    const crop7H = Math.floor(origH * 0.3);
    const crop7Left = Math.floor(origW * 0.1);
    const crop7W = Math.floor(origW * 0.8);
    if (crop7H > 100 && crop7W > 100) {
      const r7 = tryQr(await toRgba(
        sharp(buf)
          .extract({ left: crop7Left, top: crop7Top, width: crop7W, height: crop7H })
          .normalise()
          .resize({ width: Math.max(crop7W * 2, 1000), withoutEnlargement: false })
      ));
      if (r7) return { data: r7, error: null };
    }

    // Attempt 8: full image upscaled 2x
    const r8 = tryQr(await toRgba(sharp(buf).normalise().resize({ width: Math.max(origW * 2, 1600), withoutEnlargement: false })));
    if (r8) return { data: r8, error: null };

    console.log('[slip-verify] QR: not found after 8 attempts');
    return { data: null, error: null };
  } catch (err) {
    console.error('[slip-verify] QR scan error:', err);
    return { data: null, error: String((err as any)?.message ?? err).slice(0, 300) };
  }
}

// ── QR Decode ───────────────────────────────────────────

export type KbzQrPayload = { version: string; expiry: number; transactionId: string; timestamp: number; type: string };

export function decodeKbzQr(qrData: string): KbzQrPayload | null {
  try {
    const parts = qrData.trim().split('.');
    if (parts.length < 3 || parts[0] !== 'KPRSC') return null;
    const p = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return { version: p.v ?? '', expiry: Number(p.exp ?? 0), transactionId: p.tid ?? '', timestamp: Number(p.ts ?? 0), type: p.typ ?? '' };
  } catch { return null; }
}

// ── AI Vision ───────────────────────────────────────────

export type SlipData = {
  amount: number | null; transactionId: string | null; recipientName: string | null;
  recipientAccount: string | null; senderName: string | null; bankName: string | null;
  dateTime: string | null; status: string | null;
  /** AI thinks the screenshot may have been edited (fonts/alignment/patches). */
  looksEdited: boolean;
};

export async function extractSlipData(imageBase64: string, mediaType: string = 'image/jpeg'): Promise<SlipData> {
  if (!ANTHROPIC_API_KEY) throw new SlipAiUnavailableError('ANTHROPIC_API_KEY not configured');

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: `Analyze this image. Is this a mobile banking payment slip/receipt? Extract details. The slip may be in Burmese or English.

Burmese field names:
- လုပ်ဆောင်သော အချိန် = Transaction Time
- လုပ်ဆောင်မှုအမှတ် = Transaction No
- လုပ်ဆောင်မှုအမျိုးအစား = Transaction Type
- ငွေလွှဲမည် သို့ = Transfer To
- ငွေပမာဏ = Amount
- E-Receipt = confirmed successful payment

IMPORTANT for bankName: identify which PAYMENT APP or PLATFORM generated this slip — the app the SENDER used to make the payment. Look at the logo, header, branding, and footer of the slip.
- KBZ Pay / KBZ Bank: Blue header with red KBZ triangle logo, or "KBZ BANK" text, or "Thank you for using KBZPay", or "E-Receipt" with KBZ branding, or yellow background with "ks" icon and "Send Money" → bankName is "KBZPay"
- WavePay / Wave Money: Purple/blue theme, Wave logo, "Wave" text, "WavePay" branding → bankName is "WavePay"  
- AYA Pay / AYA Bank: AYA logo, green theme, "AYAPay" or "AYA Bank" text → bankName is "AYAPay"
- CB Pay / CB Bank: CB Bank logo → bankName is "CBPay"
- Do NOT confuse the recipient's bank with the sender's payment app

Return ONLY a JSON object, no backticks:
{
  "isPaymentSlip": <true if this is a real banking payment slip/receipt, false if random image>,
  "amount": <number or null — transfer amount as positive number>,
  "transactionId": "<full Transaction No string or null>",
  "recipientName": "<who money was sent TO, name only, or null>",
  "recipientAccount": "<recipient account with masked digits like ******4551 or null>",
  "senderName": "<sender name or null>",
  "bankName": "<the PAYMENT APP that generated this slip: KBZPay, WavePay, AYAPay, CBPay, or null>",
  "dateTime": "<transaction date and time or null>",
  "status": "<set 'success' if this is an E-Receipt or shows completed payment. 'failed' only if explicitly failed. null if not a payment slip>",
  "looksEdited": <true ONLY if you see clear signs the screenshot was digitally edited: a number in a different font, size, weight or colour from the text around it, misaligned or uneven digits, smudged or patched areas, mismatched backgrounds behind text. false otherwise>
}` },
        ],
      }],
    }),
  });
  } catch (netErr: any) {
    console.error('[slip-verify] Claude API network error:', netErr);
    throw new SlipAiUnavailableError(`Network error: ${netErr?.message ?? netErr}`);
  }

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error('[slip-verify] Claude API error:', response.status, err);
    // A plain 400 usually means the image itself was rejected (too big, bad
    // format) — that's the customer's image. Everything else (auth, no
    // credits — which the API reports as a 400 — rate limit, outage) is the
    // AI being unavailable.
    const isImageProblem = response.status === 400 && !/credit/i.test(err);
    if (isImageProblem) throw new Error(`Claude API error ${response.status}: ${err}`);
    throw new SlipAiUnavailableError(`Claude API error ${response.status}: ${err.slice(0, 300)}`, response.status);
  }

  const data = await response.json();
  const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') ?? '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  // If AI says it's not a payment slip, mark bankName as null
  if (parsed.isPaymentSlip === false) {
    return { amount: null, transactionId: null, recipientName: null, recipientAccount: null, senderName: null, bankName: null, dateTime: null, status: null, looksEdited: false };
  }

  return {
    amount: parsed.amount != null ? Number(parsed.amount) : null,
    transactionId: parsed.transactionId ?? null,
    recipientName: parsed.recipientName ?? null,
    recipientAccount: parsed.recipientAccount ?? null,
    senderName: parsed.senderName ?? null,
    bankName: parsed.bankName ?? null,
    dateTime: parsed.dateTime ?? null,
    status: parsed.status ?? null,
    looksEdited: parsed.looksEdited === true,
  };
}

// ── KBZ QR structure checks ─────────────────────────────
//
// What a real KBZPay e-receipt QR contains (checked on real slips):
//   KPRSC.<base64 JSON>.<base64 64-byte signature>
//   JSON: { v, exp, tid, ts, typ }
//   - tid: 20 digits; digits 5-8 = days since 1 Jan 2015 (Myanmar date)
//   - ts:  payment time in ms (matches the slip time to the second)
//   - exp: ts + 30 days
// KBZ's signing key is not public, so the signature itself cannot be
// verified; these cross-checks make a hand-made QR very hard to get right.

const YANGON_OFFSET_MS = 6.5 * 3600 * 1000;
const KBZ_TID_EPOCH_MS = Date.UTC(2015, 0, 1);
const DAY_MS = 86_400_000;

export const AUTO_APPROVE_RECENT_HOURS = 48;
export const MIN_SLIP_AMOUNT = 500;

/** Returns a reason string if the QR does not look like a genuine KBZ receipt QR. */
export function checkKbzQrStructure(qr: KbzQrPayload, raw: string): string | null {
  if (!/^\d{20}$/.test(qr.transactionId)) return 'QR transaction number has the wrong format';
  if (!qr.timestamp || !qr.expiry) return 'QR has no time';
  const sig = raw.trim().split('.')[2] ?? '';
  let sigLen = 0;
  try { sigLen = Buffer.from(sig, 'base64').length; } catch { sigLen = 0; }
  if (sigLen !== 64) return 'QR signature has the wrong size';
  if (Math.abs(qr.expiry - qr.timestamp - 30 * DAY_MS) > 10 * 60 * 1000) return 'QR expiry does not follow KBZ pattern';
  if (qr.timestamp > Date.now() + 10 * 60 * 1000) return 'QR time is in the future';
  const qrDay = Math.floor((qr.timestamp + YANGON_OFFSET_MS - KBZ_TID_EPOCH_MS) / DAY_MS);
  const tidDay = Number(qr.transactionId.slice(4, 8));
  if (Math.abs(tidDay - qrDay) > 1) return `Transaction number date (${tidDay}) does not match QR date (${qrDay})`;
  return null;
}

/** Parse "18/11/2026 07:49:01" (Myanmar time) → epoch ms, or null. */
export function parseSlipTime(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})[^\d]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  const [, d, mo, y, h, mi, se, ap] = m;
  let hour = Number(h);
  if (ap) {
    const pm = ap.toLowerCase() === 'pm';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(mi), Number(se ?? 0)) - YANGON_OFFSET_MS;
  return Number.isFinite(utc) ? utc : null;
}

// ── Verification ────────────────────────────────────────

export type VerificationChecks = {
  qrFound: boolean; qrValid: boolean; qrStructureOk: boolean; noDuplicate: boolean;
  isKbzPay: boolean; paymentSuccessful: boolean; amountRead: boolean;
  recipientNameMatch: boolean; recipientAccountMatch: boolean;
  qrSlipTransactionMatch: boolean | null; qrSlipTimeMatch: boolean | null;
  recent: boolean; notEdited: boolean; withinAutoApproveLimit: boolean;
};

export type VerificationDecision =
  | 'AUTO_APPROVE'
  | 'MANUAL_REVIEW'
  | 'REJECT'
  | 'RETRY_QR'          // no QR found → ask for the full screenshot (no AI used)
  | 'RETRY_UNREADABLE'  // amount could not be read → ask for a clearer screenshot
  | 'AI_DOWN';          // slip AI unavailable → caller falls back to typed amount + manual review

export type RejectCode = 'not_kbz' | 'forged' | 'duplicate' | 'wrong_recipient' | 'not_successful' | 'too_small' | null;

export type VerificationResult = {
  qrPayload: KbzQrPayload | null;
  slipData: SlipData | null;
  checks: VerificationChecks;
  decision: VerificationDecision;
  rejectCode: RejectCode;
  reason: string;
  transactionId: string | null;
  amount: number | null;
  aiError?: SlipAiUnavailableError;
  /** Something on our side broke (not the customer's slip) — alert the admin. */
  systemError?: string;
};

/**
 * Order (cheap and hard-to-fake first):
 *  1. QR scan + KBZ structure checks       (free)
 *  2. duplicate / admin-blocked slip check (free)
 *  3. AI reads the slip                    (paid)
 *  4. cross-checks: KBZ, success, recipient name AND last digits,
 *     QR tid = slip tid, QR time ≈ slip time, recent, not edited, limit
 */
export async function verifyKbzSlip(opts: {
  imageBase64: string;
  mediaType: string;
  checkDuplicate: (tid: string) => Promise<boolean>;
  /** Skip the AI (used for the typed-amount fallback while the AI is down). */
  skipAi?: boolean;
}): Promise<VerificationResult> {
  const { imageBase64, mediaType, checkDuplicate } = opts;
  const reasons: string[] = [];
  const checks: VerificationChecks = {
    qrFound: false, qrValid: false, qrStructureOk: false, noDuplicate: true,
    isKbzPay: false, paymentSuccessful: false, amountRead: false,
    recipientNameMatch: false, recipientAccountMatch: false,
    qrSlipTransactionMatch: null, qrSlipTimeMatch: null,
    recent: false, notEdited: true, withinAutoApproveLimit: false,
  };
  const done = (
    decision: VerificationDecision,
    rejectCode: RejectCode,
    extra: Partial<VerificationResult> = {}
  ): VerificationResult => ({
    qrPayload: null, slipData: null, checks, decision, rejectCode,
    reason: reasons.join('; ') || 'All checks passed', transactionId: null, amount: null, ...extra,
  });

  // 1) QR first
  const scan = await scanQrFromImageDetailed(imageBase64);
  const qrRaw = scan.data;
  if (!qrRaw) {
    reasons.push(scan.error ? 'QR scanner error' : 'No QR code found');
    return done('RETRY_QR', null, scan.error ? { systemError: `QR scanner crashed: ${scan.error}` } : {});
  }
  checks.qrFound = true;
  const qr = decodeKbzQr(qrRaw);
  if (!qr) { reasons.push('QR is not a KBZPay receipt QR'); return done('REJECT', 'not_kbz'); }
  checks.qrValid = true;
  const structErr = checkKbzQrStructure(qr, qrRaw);
  if (structErr) {
    reasons.push(`FORGERY: ${structErr}`);
    return done('REJECT', 'forged', { qrPayload: qr, transactionId: qr.transactionId });
  }
  checks.qrStructureOk = true;
  checks.recent = Date.now() - qr.timestamp <= AUTO_APPROVE_RECENT_HOURS * 3600 * 1000;

  // 2) Used before / blocked by admin?
  if (await checkDuplicate(qr.transactionId)) {
    checks.noDuplicate = false;
    reasons.push('Duplicate transaction ID');
    return done('REJECT', 'duplicate', { qrPayload: qr, transactionId: qr.transactionId });
  }

  if (opts.skipAi) return done('AI_DOWN', null, { qrPayload: qr, transactionId: qr.transactionId });

  // 3) AI reads the slip
  let slip: SlipData;
  try {
    slip = await extractSlipData(imageBase64, mediaType);
  } catch (err) {
    if (err instanceof SlipAiUnavailableError) {
      reasons.push('Slip AI unavailable');
      return done('AI_DOWN', null, { qrPayload: qr, transactionId: qr.transactionId, aiError: err });
    }
    throw err;
  }
  const base = { qrPayload: qr, slipData: slip, transactionId: qr.transactionId };

  // 4a) KBZ + successful
  const bn = (slip.bankName ?? '').toLowerCase().replace(/\s+/g, '');
  checks.isKbzPay = bn.includes('kbz');
  if (!checks.isKbzPay) {
    reasons.push(`Not KBZ Pay (detected: ${slip.bankName ?? 'unknown'})`);
    return done('REJECT', 'not_kbz', base);
  }
  const st = (slip.status ?? '').toLowerCase();
  checks.paymentSuccessful =
    /success|complete|approved|confirm|receipt|paid/.test(st) ||
    (!!slip.amount && !!slip.recipientName && st !== 'failed');
  if (!checks.paymentSuccessful) {
    reasons.push('Payment not successful');
    return done('REJECT', 'not_successful', base);
  }

  // 4b) Amount from the slip
  const amount = slip.amount != null && Number.isFinite(slip.amount) ? Math.round(Math.abs(slip.amount)) : null;
  checks.amountRead = !!amount && amount > 0;
  if (!checks.amountRead || amount == null) {
    reasons.push('Amount not readable');
    return done('RETRY_UNREADABLE', null, base);
  }
  if (amount < MIN_SLIP_AMOUNT) {
    reasons.push(`Amount below ${MIN_SLIP_AMOUNT}`);
    return done('REJECT', 'too_small', { ...base, amount });
  }
  checks.withinAutoApproveLimit = amount <= AUTO_APPROVE_MAX;

  // 4c) Recipient: name AND last digits
  const rName = (slip.recipientName ?? '').trim().toLowerCase();
  const rAcct = (slip.recipientAccount ?? '').replace(/\D/g, '');
  for (const admin of ADMIN_ACCOUNTS) {
    const an = admin.name.toLowerCase();
    if (rName.length >= 3 && (rName.includes(an) || an.includes(rName))) checks.recipientNameMatch = true;
    if (rAcct.endsWith(admin.lastDigits)) checks.recipientAccountMatch = true;
  }
  if (!checks.recipientNameMatch && !checks.recipientAccountMatch) {
    reasons.push(`Recipient mismatch: "${slip.recipientName}" / "${slip.recipientAccount}"`);
    return done('REJECT', 'wrong_recipient', { ...base, amount });
  }
  if (!checks.recipientNameMatch || !checks.recipientAccountMatch) reasons.push('Recipient only partly matches');

  // 4d) QR vs slip: transaction number + time
  const slipTid = (slip.transactionId ?? '').replace(/\D/g, '');
  if (slipTid) {
    checks.qrSlipTransactionMatch = slipTid === qr.transactionId;
    if (!checks.qrSlipTransactionMatch) {
      reasons.push('FORGERY: QR tid ≠ slip tid');
      return done('REJECT', 'forged', { ...base, amount });
    }
  } else {
    reasons.push('Slip transaction number not read');
  }
  const slipMs = parseSlipTime(slip.dateTime);
  if (slipMs != null) {
    checks.qrSlipTimeMatch = Math.abs(slipMs - qr.timestamp) <= 3 * 60 * 1000;
    if (!checks.qrSlipTimeMatch) {
      reasons.push('FORGERY: slip time ≠ QR time');
      return done('REJECT', 'forged', { ...base, amount });
    }
  }

  // 4e) Edited? old? big?
  checks.notEdited = !slip.looksEdited;
  if (!checks.notEdited) reasons.push('Slip may be edited');
  if (!checks.recent) reasons.push(`Payment older than ${AUTO_APPROVE_RECENT_HOURS}h`);
  if (!checks.withinAutoApproveLimit) reasons.push(`Over auto-approve limit (${AUTO_APPROVE_MAX})`);

  const auto =
    checks.recipientNameMatch &&
    checks.recipientAccountMatch &&
    checks.qrSlipTransactionMatch === true &&
    checks.qrSlipTimeMatch !== false &&
    checks.notEdited &&
    checks.recent &&
    checks.withinAutoApproveLimit;

  return done(auto ? 'AUTO_APPROVE' : 'MANUAL_REVIEW', null, { ...base, amount });
}
