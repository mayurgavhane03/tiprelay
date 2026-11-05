import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
export function WelcomeScreen({
  onSignIn,
  busy,
  error,
}: {
  onSignIn: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <View>
      <Text style={s.tag}>FOR THE MOMENTS THAT MATTER</Text>
      <Text style={s.title}>
        Your community.{'\n'}Your next big{'\n'}thank you.
      </Text>
      <Text style={s.copy}>
        Turn direct UPI tips into live stream alerts. Your Android phone
        connects the support you receive to the moments you share.
      </Text>
      <View style={s.preview}>
        <Text style={s.tag}>SAMPLE OBS ALERT</Text>
        <Text style={s.amount}>₹100 of community love</Text>
        <Text style={s.copy}>A little support. A big stream moment.</Text>
      </View>
      {[
        [
          '01',
          'Sign in with Google',
          'Use the same account as your web dashboard.',
        ],
        [
          '02',
          'Pair your phone',
          'Enter a short-lived code from your dashboard.',
        ],
        [
          '03',
          'Bring your stream to life',
          'Add your private Browser Source to OBS.',
        ],
      ].map(([n, title, body]) => (
        <View style={s.step} key={n}>
          <Text style={s.number}>{n}</Text>
          <View style={s.stepCopy}>
            <Text style={s.stepTitle}>{title}</Text>
            <Text style={s.body}>{body}</Text>
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onSignIn}
        style={[s.button, busy && { opacity: 0.6 }]}
      >
        <Text style={s.buttonText}>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Text style={s.privacy}>
        Your payments stay in your account. Notification access is requested
        after pairing. Raw notifications and payer details stay on your phone.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  tag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#6b8757',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1.5,
    color: '#294832',
    marginVertical: 20,
  },
  copy: { fontSize: 15, lineHeight: 24, color: '#6c7e64' },
  preview: {
    backgroundColor: '#e0ebcf',
    padding: 24,
    borderRadius: 18,
    marginVertical: 24,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#395a3b',
    marginVertical: 10,
  },
  step: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  number: { fontSize: 15, color: '#6a8753', paddingTop: 3 },
  stepCopy: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#34503b' },
  body: { fontSize: 13, lineHeight: 20, color: '#77876f', marginTop: 5 },
  button: {
    backgroundColor: '#42674b',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  privacy: {
    fontSize: 11,
    color: '#78866f',
    lineHeight: 18,
    marginVertical: 20,
  },
  error: { color: '#a14632', marginTop: 15 },
});
