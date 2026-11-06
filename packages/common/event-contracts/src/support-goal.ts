import { z } from 'zod';

const color = z.string().regex(/^#[\da-f]{6}$/i);
const date = z.string().date();
export const supportGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    targetPaise: z.number().int().min(100).max(10_000_000_000),
    startDate: date,
    endDate: date,
    visible: z.boolean(),
    style: z.object({
      fill: color,
      track: color,
      text: color,
      background: color,
      backgroundOpacity: z.number().int().min(0).max(100),
      width: z.number().int().min(160).max(1920),
      height: z.number().int().min(4).max(100),
      radius: z.number().int().min(0).max(60),
      padding: z.number().int().min(0).max(48),
      fontSize: z.number().int().min(10).max(64),
      font: z.enum(['sans-serif', 'serif', 'monospace']),
      alignment: z.enum(['left', 'center', 'right']),
      showTitle: z.boolean(),
      showAmounts: z.boolean(),
      showPercent: z.boolean(),
    }),
  })
  .refine((goal) => goal.startDate <= goal.endDate, {
    message: 'End date must be on or after the start date',
  });

export type SupportGoal = z.infer<typeof supportGoalSchema>;
export type SupportGoalProgress = { goal: SupportGoal; observedPaise: number };

export function supportDate(timestampMs: number) {
  return new Date(timestampMs + 330 * 60_000).toISOString().slice(0, 10);
}
