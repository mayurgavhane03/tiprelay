import { NativeModules } from 'react-native';
export interface Diagnostics {
  paired: boolean;
  notificationAccess: boolean;
  lastSync: string;
  pending: number;
  lastError: string;
}
export const companion = NativeModules.TipRelay as {
  pair(url: string, code: string): Promise<void>;
  diagnostics(): Promise<Diagnostics>;
  openNotificationSettings(): void;
  unpair(): Promise<void>;
};
