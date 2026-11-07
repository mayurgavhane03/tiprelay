import type { Service } from './service';
import {
  alertControlsSchema,
  defaultAlertControls,
  settingsSchema,
} from '@tiprelay/event-contracts';
import { next } from '../persistence/store';
import { HttpError } from './shared';

export class SettingsService {
  constructor(private readonly context: Service) {}

  async settings(id: string, body: unknown) {
    const data = settingsSchema.parse(body);
    await this.context.retry(async () => {
      const p = await this.context.creator(id);
      await this.context.store.transact([next({ ...p, ...data })]);
    });
    return { ok: true };
  }

  async saveAlertControls(id: string, body: unknown) {
    const parsed = alertControlsSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, 'Invalid alert controls');
    await this.context.retry(async () => {
      const profile = await this.context.creator(id);
      await this.context.store.transact([next({ ...profile, alertControls: parsed.data })]);
    });
    return { ok: true };
  }

  async overlayAlertControls(token: string) {
    const credential = await this.context.overlay(token);
    const profile = await this.context.creator(credential.creatorId);
    if (profile.overlayVersion !== credential.overlayVersion)
      throw new HttpError(401, 'Overlay credential rotated');
    return profile.alertControls ?? defaultAlertControls;
  }
}
