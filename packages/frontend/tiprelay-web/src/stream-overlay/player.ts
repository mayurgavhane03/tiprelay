import type { Alert } from '@tiprelay/event-contracts';
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class AlertGate {
  private seen: Record<string, number> = {};
  constructor(
    private storage: StorageLike,
    private key: string,
    private now = () => Date.now() / 1000,
  ) {
    try {
      this.seen = JSON.parse(storage.getItem(key) || '{}');
    } catch {
      this.seen = {};
    }
  }
  accept(alert: Alert) {
    const now = this.now();
    this.seen = Object.fromEntries(
      Object.entries(this.seen).filter(([, expires]) => expires > now),
    );
    if (alert.expiresAt <= now || this.seen[alert.alertId]) return false;
    // Record before starting playback. A reload can drop a partial sound, but cannot replay it.
    this.seen[alert.alertId] = alert.expiresAt;
    this.storage.setItem(this.key, JSON.stringify(this.seen));
    return true;
  }
}
export async function playAudio(url: string, deadline: number) {
  if (Date.now() / 1000 >= deadline) return;
  const audio = new Audio(url);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        audio.pause();
        reject(new Error('Audio deadline exceeded'));
      },
      Math.min(30000, Math.max(0, (deadline - Date.now() / 1000) * 1000)),
    );
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      audio.pause();
      if (error) reject(error);
      else resolve();
    };
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error('Audio unavailable'));
    audio.play().catch(finish);
  });
}
