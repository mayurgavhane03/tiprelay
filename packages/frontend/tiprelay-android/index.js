import { AppRegistry, Platform } from 'react-native';
// Resolve only the platform entry: Android modules must never load on iOS.
const App = Platform.OS === 'ios'
  ? require('./src/App.ios').default
  : require('./src/App').default;
AppRegistry.registerComponent('TipRelayCompanion', () => App);
// Expo-generated iOS projects use the main registration.
AppRegistry.registerComponent('main', () => App);
