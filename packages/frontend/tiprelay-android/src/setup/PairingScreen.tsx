import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { companion } from '../native';
import { deployment } from '../auth/config';
import { accessToken } from '../auth/session';
export function PairingScreen({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Connect your channel</Text>
      <Text style={styles.copy}>
        Generate a pairing code in your TipRelay dashboard. Codes expire after
        five minutes and work once.
      </Text>
      <TextInput
        style={styles.input}
        accessibilityLabel="Pairing code"
        placeholder="12-character pairing code"
        autoCapitalize="characters"
        maxLength={12}
        value={code}
        onChangeText={setCode}
      />
      <Button
        title={busy ? 'Pairing…' : 'Pair phone'}
        disabled={busy || code.length !== 12}
        color="#477c5d"
        onPress={async () => {
          setBusy(true);
          try {
            await companion.pair(
              deployment.apiUrl,
              code.trim(),
              await accessToken(),
            );
            onPaired();
          } catch {
            setError(
              'Pairing failed. Use the same Google account as the dashboard and request a fresh code.',
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    padding: 22,
    borderRadius: 16,
    marginBottom: 18,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#2c4734',
    marginBottom: 12,
  },
  copy: { fontSize: 14, lineHeight: 22, color: '#7b8b77', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#dce5d6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    color: '#2c4734',
  },
  error: { color: '#ab4c35', marginTop: 12 },
});
