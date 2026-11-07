import type { Service } from './service';
import { defaultAlertControls } from '@tiprelay/event-contracts';
import { tenant } from './shared';

export class DashboardService {
  constructor(private readonly context: Service) {}

  async dashboard(id: string) {
    const profile = await this.context.provision(id),
      rows = (await this.context.store.query(tenant(id))).filter(
        (r) => !r.ttl || r.ttl > this.context.clock(),
      );
    return {
      profile: {
        creatorId: id,
        slug: profile.slug,
        displayName: profile.displayName,
        upiId: profile.upiId,
      },
      devices: rows
        .filter((r) => r.sk.startsWith('DEVICE#'))
        .map((d) => ({
          deviceId: d.deviceId,
          revoked: d.revoked,
          lastSync: d.lastSync,
          pairedAt: d.pairedAt,
        })),
      connections: rows.filter(
        (r) => r.sk.startsWith('CONNECTION#') && r.overlayVersion === profile.overlayVersion,
      ).length,
      alertControls: profile.alertControls ?? defaultAlertControls,
      supportGoal: this.context.goalProgress(profile.supportGoal, rows),
      observations: rows
        .filter((r) => r.sk.startsWith('OBS#'))
        .map((r) => ({
          alertId: r.alertId,
          amountPaise: r.amountPaise,
          observedAt: r.observedAt,
          verifiedAt: r.verifiedAt,
          transactionReference: r.transactionReference,
        })),
      messages: rows
        .filter((r) => r.sk.startsWith('MESSAGE#'))
        .map((m) => ({
          messageId: m.messageId,
          text: m.text,
          amountPaise: m.amountPaise,
          status: m.status,
          createdAt: m.createdAt,
          ...this.context.match(m, rows),
        })),
      jobs: rows
        .filter((r) => r.sk.startsWith('JOB#'))
        .map((j) => ({ jobId: j.jobId, status: j.status, expiresAt: j.expiresAt })),
      notice:
        'Observed credits are best-effort notification signals. Verify settlement in your bank or UPI app.',
      speechAvailable: process.env.SPEECH_ENABLED !== 'false',
    };
  }
}
