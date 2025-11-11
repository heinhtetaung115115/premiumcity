import { z } from 'zod';

export const registrationSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2)
  })
  .strict();

export const topupSchema = z
  .object({
    bankName: z.string().min(2),
    amount: z.coerce.number().positive(),
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
