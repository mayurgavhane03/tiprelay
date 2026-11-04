import { z } from 'zod';
export const alertSchema = z
  .object({
    alertId: z.string(),
    kind: z.enum(['credit', 'test', 'speech']),
    createdAt: z.number(),
    expiresAt: z.number(),
    amountPaise: z.number().int().optional(),
    audioUrl: z.string().url().optional(),
  })
  .strict();
export type Alert = z.infer<typeof alertSchema>;
