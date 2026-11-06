import { z } from 'zod';

export const alertControlsSchema = z
  .object({
    paused: z.boolean(),
    muteSpeech: z.boolean(),
    minimumPaise: z.number().int().min(0).max(100000000),
    volume: z.number().int().min(0).max(100),
    displaySeconds: z.number().int().min(1).max(30),
  })
  .strict();

export type AlertControls = z.infer<typeof alertControlsSchema>;
export const defaultAlertControls: AlertControls = {
  paused: false,
  muteSpeech: false,
  minimumPaise: 0,
  volume: 100,
  displaySeconds: 4,
};
