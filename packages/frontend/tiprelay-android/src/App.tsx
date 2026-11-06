import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, Text, StyleSheet, Button } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { account, signIn, signOut } from './auth/session';
import { WelcomeScreen } from './welcome/WelcomeScreen';
import { companion, type Diagnostics } from './native';
import { PairingScreen } from './setup/PairingScreen';
import { DiagnosticsScreen } from './diagnostics/DiagnosticsScreen';
export default function App() {
  const [signedIn, setSignedIn] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    void account()
      .then(() => setSignedIn(true))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);
  const login = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn();
      setSignedIn(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await signOut();
      setSignedIn(false);
      refresh();
    } catch {
      setError('Unable to clear local credentials. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    paired: false,
    creatorId: '',
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
    const sub = AppState.addEventListener('change', state => {
      refresh();
      if (state === 'active' && signedIn)
        void account().catch(() => {
          setSignedIn(false);
          setError('Sign in again to check your account.');
        });
    });
    const timer = setInterval(refresh, 10000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [signedIn]);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.brand}>TipRelay ↗</Text>
          <Text style={s.subtitle}>Your phone. Your tips. Your stream.</Text>
          {!signedIn ? (
            <WelcomeScreen
              onSignIn={() => void login()}
              busy={busy}
              error={error}
            />
          ) : (
            <>
              <Text accessibilityRole="header" style={s.dashboard}>Creator dashboard</Text>
              {!diagnostics.paired && <PairingScreen onPaired={refresh} />}
              <DiagnosticsScreen value={diagnostics} refresh={refresh} />
              <Button
                title="Sign out and disconnect phone"
                disabled={busy}
                onPress={() => void logout()}
              />
              {!!error && <Text>{error}</Text>}
              <Text style={s.foot}>
                PhonePe and Google Pay parsers are awaiting real-device release validation. See
                the supported-format guide before relying on alerts.
              </Text>
            </>
          )}
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
  dashboard: { fontSize: 23, fontWeight: '700', color: '#294832', marginBottom: 16 },
  foot: { fontSize: 12, color: '#8c977f', lineHeight: 20, marginBottom: 20 },
});
