import { NativeModules } from 'react-native';
// Populated from the selected environment during the native build. Public values only.
export const deployment: {
  apiUrl: string;
  cognitoDomain: string;
  mobileClientId: string;
  webUrl: string;
} = NativeModules.TipRelay.deployment;
