import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registrationSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    name: z.string().min(2)
  })
  .strict();

export const MAX_TOPUP_AMOUNT = 5_000_000; // MMK — sanity ceiling for a single manual top-up
export const MIN_TOPUP_AMOUNT = 500; // MMK

export const topupSchema = z
  .object({
    bankName: z.string().min(2),
    amount: z.coerce.number().positive().min(MIN_TOPUP_AMOUNT).max(MAX_TOPUP_AMOUNT),
    referenceHint: z.string().min(4).max(10),
    note: z.string().max(500).optional()
  })
  .strict();

export const productPurchaseSchema = z
  .object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.coerce.number().int().positive().default(1),
    manualInput: z.record(z.string().min(1)).optional()
  })
  .strict();

export const bankAccountSchema = z
  .object({
    bankName: z.string().min(2),
    accountName: z.string().min(2),
    accountNo: z.string().min(4),
    instructions: z.string().optional(),
    qrCodeUrl: z.string().url().optional()
  })
  .strict();
