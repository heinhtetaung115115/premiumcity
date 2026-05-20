// lib/slip-verify.ts
import jsQR from 'jsqr';
import sharp from 'sharp';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const ADMIN_ACCOUNTS = [
  { name: 'Hein Htet Aung', lastDigits: '4551' },
];

const AUTO_APPROVE_MAX = 50000;

// ── QR Scanning ─────────────────────────────────────────

export async function scanQrFromImage(imageBase64: string): Promise<string | null> {
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
    if (r1) return r1;

    // Attempt 2: normalised
    const r2 = tryQr(await toRgba(sharp(buf).normalise()));
    if (r2) return r2;

    // Attempt 3: bottom 35% (saved slip / e-receipt format)
    const crop3Top = Math.floor(origH * 0.65);
    const crop3H = origH - crop3Top;
    if (crop3H > 100) {
      const r3 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop3Top, width: origW, height: crop3H }).normalise()));
      if (r3) return r3;
    }

    // Attempt 4: middle 40-75% region (app screenshot — QR is in middle-bottom area)
    const crop4Top = Math.floor(origH * 0.4);
    const crop4H = Math.floor(origH * 0.35);
    if (crop4H > 100) {
      const r4 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop4Top, width: origW, height: crop4H }).normalise()));
      if (r4) return r4;
    }

    // Attempt 5: bottom 50% (wider crop for tall phone screenshots)
    const crop5Top = Math.floor(origH * 0.5);
    const crop5H = origH - crop5Top;
    if (crop5H > 100) {
      const r5 = tryQr(await toRgba(sharp(buf).extract({ left: 0, top: crop5Top, width: origW, height: crop5H }).normalise()));
      if (r5) return r5;
    }

    // Attempt 6: bottom 50% upscaled (small QR in tall screenshot)
    if (crop5H > 100) {
      const r6 = tryQr(await toRgba(
        sharp(buf)
          .extract({ left: 0, top: crop5Top, width: origW, height: crop5H })
          .normalise()
          .resize({ width: Math.max(origW * 2, 1400), withoutEnlargement: false })
      ));
      if (r6) return r6;
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
      if (r7) return r7;
    }

    // Attempt 8: full image upscaled 2x
    const r8 = tryQr(await toRgba(sharp(buf).normalise().resize({ width: Math.max(origW * 2, 1600), withoutEnlargement: false })));
    if (r8) return r8;

    console.log('[slip-verify] QR: not found after 8 attempts');
    return null;
  } catch (err) {
    console.error('[slip-verify] QR scan error:', err);
    return null;
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
};

export async function extractSlipData(imageBase64: string, mediaType: string = 'image/jpeg'): Promise<SlipData> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  "status": "<set 'success' if this is an E-Receipt or shows completed payment. 'failed' only if explicitly failed. null if not a payment slip>"
}` },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    console.error('[slip-verify] Claude API error:', response.status, err);
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') ?? '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  // If AI says it's not a payment slip, mark bankName as null
  if (parsed.isPaymentSlip === false) {
    return { amount: null, transactionId: null, recipientName: null, recipientAccount: null, senderName: null, bankName: null, dateTime: null, status: null };
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
  };
}

// ── Verification ────────────────────────────────────────

export type VerificationChecks = {
  paymentSuccessful: boolean; amountMatch: boolean; recipientMatch: boolean;
  qrFound: boolean; qrValid: boolean; qrSlipTransactionMatch: boolean;
  noDuplicate: boolean; withinAutoApproveLimit: boolean; isKbzPay: boolean;
};

export type VerificationResult = {
  qrPayload: KbzQrPayload | null; slipData: SlipData; checks: VerificationChecks;
  decision: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'REJECT'; reason: string; transactionId: string | null;
};

export async function verifyKbzSlip(opts: {
  imageBase64: string; mediaType: string; claimedAmount: number;
  checkDuplicate: (tid: string) => Promise<boolean>;
}): Promise<VerificationResult> {
  const { imageBase64, mediaType, claimedAmount, checkDuplicate } = opts;
  const reasons: string[] = [];
  const checks: VerificationChecks = {
    paymentSuccessful: false, amountMatch: false, recipientMatch: false,
    qrFound: false, qrValid: false, qrSlipTransactionMatch: false,
    noDuplicate: true, withinAutoApproveLimit: false, isKbzPay: false,
  };

  // ── Step 1: AI reads slip FIRST ──
  const slipData = await extractSlipData(imageBase64, mediaType);

  // ── Step 2: Is this KBZ Pay? Check immediately ──
  if (slipData.bankName) {
    const bn = slipData.bankName.toLowerCase().replace(/\s+/g, '');
    checks.isKbzPay = bn.includes('kbzpay') || bn.includes('kbzbank') || bn === 'kbz';
  }
  if (!slipData.bankName && !slipData.amount && !slipData.recipientName) {
    checks.isKbzPay = false;
    reasons.push('Not a payment slip');
  } else if (!checks.isKbzPay) {
    reasons.push(`Not KBZ Pay (detected: ${slipData.bankName ?? 'unknown'})`);
  }

  // If NOT KBZ → reject immediately, skip QR scan and all other checks
  if (!checks.isKbzPay) {
    return {
      qrPayload: null, slipData, checks,
      decision: 'REJECT',
      reason: reasons.join('; ') || 'Not a KBZ Pay slip',
      transactionId: null,
    };
  }

  // ── Step 3: Scan QR (only for KBZ slips) ──
  let qrPayload: KbzQrPayload | null = null;
  const qrRaw = await scanQrFromImage(imageBase64);
  if (qrRaw) {
    checks.qrFound = true;
    qrPayload = decodeKbzQr(qrRaw);
    if (qrPayload) checks.qrValid = true;
    else reasons.push('QR found but not valid KBZ format');
  } else {
    reasons.push('No QR code found');
  }

  // ── Step 4: Run all other checks ──
  if (slipData.status) {
    const s = slipData.status.toLowerCase();
    checks.paymentSuccessful = s.includes('success') || s.includes('complete') || s.includes('approved') ||
      s.includes('confirm') || s.includes('receipt') || s === 'paid' ||
      s.includes('ငွေပေးချေ') || s.includes('ငွေလွဲ') || s.includes('အောင်မြင်') || s.includes('ပြီးစီး');
  }
  if (!checks.paymentSuccessful && slipData.amount && slipData.recipientName) {
    checks.paymentSuccessful = true;
  }
  if (!checks.paymentSuccessful) reasons.push('Payment not confirmed successful');

  // 3c. Amount matches?
  if (slipData.amount != null) {
    const diff = Math.abs(slipData.amount - claimedAmount);
    checks.amountMatch = diff <= claimedAmount * 0.02;
  }
  if (!checks.amountMatch) {
    reasons.push(`Amount mismatch: slip=${slipData.amount ?? '?'}, entered=${claimedAmount}`);
  }

  // 3d. Recipient matches admin?
  if (slipData.recipientName || slipData.recipientAccount) {
    for (const admin of ADMIN_ACCOUNTS) {
      const nameOk = slipData.recipientName?.toLowerCase().includes(admin.name.toLowerCase()) ||
        admin.name.toLowerCase().includes(slipData.recipientName?.toLowerCase() ?? '');
      const acctOk = slipData.recipientAccount?.includes(admin.lastDigits);
      if (nameOk || acctOk) { checks.recipientMatch = true; break; }
    }
  }
  if (!checks.recipientMatch) reasons.push(`Recipient mismatch: "${slipData.recipientName}" / "${slipData.recipientAccount}"`);

  // 3e. QR vs slip cross-check
  if (qrPayload && slipData.transactionId) {
    const qrTid = qrPayload.transactionId.replace(/\D/g, '');
    const slipTid = slipData.transactionId.replace(/\D/g, '');
    checks.qrSlipTransactionMatch = qrTid === slipTid && qrTid.length > 0;
    if (!checks.qrSlipTransactionMatch) reasons.push(`FORGERY: QR tid≠slip tid`);
  }

  // 3f. Duplicate check — ONLY run if it looks like a real KBZ slip
  const verifiedTid = qrPayload?.transactionId || slipData.transactionId;
  if (checks.isKbzPay && verifiedTid) {
    if (await checkDuplicate(verifiedTid)) { checks.noDuplicate = false; reasons.push('Duplicate transaction ID'); }
  } else if (checks.isKbzPay && !verifiedTid) {
    checks.noDuplicate = false;
    reasons.push('No transaction ID found');
  }
  // If not KBZ pay, leave noDuplicate as true (irrelevant, isKbzPay check will reject first)

  // 3g. Under limit?
  checks.withinAutoApproveLimit = slipData.amount != null && slipData.amount <= AUTO_APPROVE_MAX;

  // ── Decision ──
  // REJECT: strong evidence of fraud or invalid slip
  let decision: VerificationResult['decision'];

  if (!checks.isKbzPay) {
    decision = 'REJECT'; // Not a KBZ slip or not a payment slip at all
  } else if (!checks.noDuplicate) {
    decision = 'REJECT'; // Duplicate
  } else if (!checks.recipientMatch) {
    decision = 'REJECT'; // Wrong recipient
  } else if (!checks.amountMatch) {
    decision = 'REJECT'; // Amount mismatch
  } else if (!checks.paymentSuccessful) {
    decision = 'REJECT'; // Not successful
  } else if (checks.qrFound && checks.qrValid && !checks.qrSlipTransactionMatch) {
    decision = 'REJECT'; // Forged slip
  }
  // QR not found → user must retry
  else if (!checks.qrFound) {
    decision = 'MANUAL_REVIEW';
  }
  // All pass → approve
  else if (checks.qrFound && checks.qrValid && checks.qrSlipTransactionMatch &&
    checks.noDuplicate && checks.withinAutoApproveLimit) {
    decision = 'AUTO_APPROVE';
  }
  else {
    decision = 'MANUAL_REVIEW';
  }

  return { qrPayload, slipData, checks, decision, reason: reasons.length > 0 ? reasons.join('; ') : 'All checks passed', transactionId: verifiedTid ?? null };
}
