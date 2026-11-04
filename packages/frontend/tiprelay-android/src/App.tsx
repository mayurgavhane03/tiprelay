import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { companion, type Diagnostics } from './native';
import { PairingScreen } from './setup/PairingScreen';
import { DiagnosticsScreen } from './diagnostics/DiagnosticsScreen';
export default function App() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    paired: false,
    notificationAccess: false,
    lastSync: '',
    pending: 0,
    lastError: '',
  });
  const refresh = () => {
    companion
      .diagnostics()
      .then(setDiagnostics)
      .catch(() =>
        setDiagnostics(d => ({
          ...d,
          lastError: 'Native diagnostics unavailable',
        })),
      );
  };
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', refresh);
    const timer = setInterval(refresh, 10000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.brand}>TipRelay ↗</Text>
          <Text style={s.subtitle}>Your phone. Your tips. Your stream.</Text>
          {!diagnostics.paired && <PairingScreen onPaired={refresh} />}
          <DiagnosticsScreen value={diagnostics} refresh={refresh} />
          <Text style={s.foot}>
            PhonePe parser is awaiting real-device release validation. See the
            supported-format guide before relying on alerts.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5eb' },
  content: { padding: 24 },
  brand: { fontSize: 32, fontWeight: '800', color: '#3e6547', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#87977d', marginTop: 10, marginBottom: 30 },
  foot: { fontSize: 12, color: '#8c977f', lineHeight: 20, marginBottom: 20 },
});
