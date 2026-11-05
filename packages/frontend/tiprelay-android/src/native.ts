import { NativeModules } from 'react-native';
export interface Diagnostics {
  paired: boolean;
  creatorId: string;
  notificationAccess: boolean;
  lastSync: string;
  pending: number;
  lastError: string;
}
export const companion = NativeModules.TipRelay as {
  pair(url: string, code: string, accessToken: string): Promise<void>;
  saveSession(refreshToken: string): Promise<void>;
  readSession(): Promise<string | null>;
  clearSession(): Promise<void>;
  diagnostics(): Promise<Diagnostics>;
  openNotificationSettings(): void;
  unpair(): Promise<void>;
};
