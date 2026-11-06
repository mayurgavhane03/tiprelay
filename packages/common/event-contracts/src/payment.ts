import { z } from 'zod';
export const reference = z
  .string()
  .trim()
  .regex(/^\d{12}$/, 'Use the 12-digit UPI transaction reference');
export const amount = z.number().int().min(100).max(10000000);
export const observationSchema = z
  .object({
    eventId: z.string().uuid(),
    sourceApp: z.enum(['com.phonepe.app', 'com.google.android.apps.nbu.paisa.user']),
    amountPaise: amount,
    payerName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[\p{L}\p{N} '-]+$/u)
      .optional(),
    observedAt: z.string().datetime(),
    transactionReference: reference.optional(),
  })
  .strict();
export const messageSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    amountPaise: amount.optional(),
    transactionReference: reference.optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    upiId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,100}@[a-zA-Z0-9.-]{2,50}$/),
  })
  .strict();
export type Observation = z.infer<typeof observationSchema>;
export type ViewerMessage = z.infer<typeof messageSchema>;
