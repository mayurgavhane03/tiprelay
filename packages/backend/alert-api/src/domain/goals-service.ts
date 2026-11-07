import type { Service } from './service';
import { supportGoalSchema, type SupportGoal } from '@tiprelay/event-contracts';
import { next, type Row } from '../persistence/store';
import { HttpError } from './shared';

export class GoalsService {
  constructor(private readonly context: Service) {}

  async saveSupportGoal(id: string, body: unknown) {
    const result = supportGoalSchema.safeParse(body);
    if (!result.success) throw new HttpError(400, result.error.issues[0].message);
    await this.context.retry(async () => {
      const profile = await this.context.creator(id);
      await this.context.store.transact([next({ ...profile, supportGoal: result.data })]);
    });
    return { ok: true };
  }

  goalProgress(goal: SupportGoal | undefined, rows: Row[]) {
    if (!goal) return null;
    const observedPaise = rows.reduce((sum, row) => {
      const day = row.sk.slice('SUPPORT#'.length);
      return row.sk.startsWith('SUPPORT#') && day >= goal.startDate && day <= goal.endDate
        ? sum + row.amountPaise
        : sum;
    }, 0);
    return { goal, observedPaise };
  }

  async overlayGoal(token: string) {
    const cred = await this.context.overlay(token);
    const profile = await this.context.creator(cred.creatorId);
    if (profile.overlayVersion !== cred.overlayVersion)
      throw new HttpError(401, 'Overlay credential rotated');
    if (!profile.supportGoal?.visible) return null;
    return this.context.goalProgress(
      profile.supportGoal,
      await this.context.store.query(profile.pk, 'SUPPORT#'),
    );
  }
}
