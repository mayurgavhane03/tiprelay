import { Conflict, type Store } from '../persistence/store';
import { AccountsService } from './accounts-service';
import { AdministrationService } from './administration-service';
import { SettingsService } from './settings-service';
import { GoalsService } from './goals-service';
import { DevicesService } from './devices-service';
import { OverlayService } from './overlay-service';
import { PaymentsService } from './payments-service';
import { AlertsService } from './alerts-service';
import { SpeechService } from './speech-service';
import { MessagesService } from './messages-service';
import { DashboardService } from './dashboard-service';
import { RateLimitService } from './rate-limit-service';

export { HttpError, hash } from './shared';

// Compatibility facade used by HTTP handlers, workers, and local development.
export class Service {
  constructor(
    readonly store: Store,
    readonly clock = () => Math.floor(Date.now() / 1000),
  ) {}

  private readonly accountsService = new AccountsService(this);
  creator = this.accountsService.creator.bind(this.accountsService);
  provision = this.accountsService.provision.bind(this.accountsService);
  account = this.accountsService.account.bind(this.accountsService);
  publicCreator = this.accountsService.publicCreator.bind(this.accountsService);
  deleteCreator = this.accountsService.deleteCreator.bind(this.accountsService);

  private readonly administrationService = new AdministrationService(this);
  requireAdmin = this.administrationService.requireAdmin.bind(this.administrationService);
  users = this.administrationService.users.bind(this.administrationService);
  manageUser = this.administrationService.manageUser.bind(this.administrationService);

  private readonly settingsService = new SettingsService(this);
  settings = this.settingsService.settings.bind(this.settingsService);
  saveAlertControls = this.settingsService.saveAlertControls.bind(this.settingsService);
  overlayAlertControls = this.settingsService.overlayAlertControls.bind(this.settingsService);

  private readonly goalsService = new GoalsService(this);
  saveSupportGoal = this.goalsService.saveSupportGoal.bind(this.goalsService);
  goalProgress = this.goalsService.goalProgress.bind(this.goalsService);
  overlayGoal = this.goalsService.overlayGoal.bind(this.goalsService);

  private readonly devicesService = new DevicesService(this);
  pairCode = this.devicesService.pairCode.bind(this.devicesService);
  pair = this.devicesService.pair.bind(this.devicesService);
  device = this.devicesService.device.bind(this.devicesService);
  revokeDevice = this.devicesService.revokeDevice.bind(this.devicesService);

  private readonly overlayService = new OverlayService(this);
  rotateOverlay = this.overlayService.rotateOverlay.bind(this.overlayService);
  overlay = this.overlayService.overlay.bind(this.overlayService);
  ticket = this.overlayService.ticket.bind(this.overlayService);
  connect = this.overlayService.connect.bind(this.overlayService);
  validConnection = this.overlayService.validConnection.bind(this.overlayService);
  disconnect = this.overlayService.disconnect.bind(this.overlayService);

  private readonly paymentsService = new PaymentsService(this);
  observe = this.paymentsService.observe.bind(this.paymentsService);
  verifyPayment = this.paymentsService.verifyPayment.bind(this.paymentsService);

  private readonly alertsService = new AlertsService(this);
  alertChanges = this.alertsService.alertChanges.bind(this.alertsService);
  testAlert = this.alertsService.testAlert.bind(this.alertsService);

  private readonly speechService = new SpeechService(this);
  amountSpeechChanges = this.speechService.amountSpeechChanges.bind(this.speechService);
  speechReady = this.speechService.speechReady.bind(this.speechService);

  private readonly messagesService = new MessagesService(this);
  submit = this.messagesService.submit.bind(this.messagesService);
  match = this.messagesService.match.bind(this.messagesService);
  moderate = this.messagesService.moderate.bind(this.messagesService);

  private readonly dashboardService = new DashboardService(this);
  dashboard = this.dashboardService.dashboard.bind(this.dashboardService);

  private readonly rateLimitService = new RateLimitService(this);
  rate = this.rateLimitService.rate.bind(this.rateLimitService);

  async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < 6; i++) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof Conflict) || i === 5) throw e;
      }
    }
    throw new Error('Unreachable');
  }
}
