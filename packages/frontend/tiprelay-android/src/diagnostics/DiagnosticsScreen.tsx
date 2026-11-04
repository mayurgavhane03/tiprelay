import React from 'react';
import { View, Text, Button } from 'react-native';
import { companion, type Diagnostics } from '../native';
import { styles } from '../setup/PairingScreen';
export function DiagnosticsScreen({
  value,
  refresh,
}: {
  value: Diagnostics;
  refresh: () => void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Notification access</Text>
        <Text style={styles.copy}>
          Android grants access to notifications across your phone. TipRelay
          processes only recognized incoming-credit formats from PhonePe, on
          this phone. It uploads an event ID, app ID, amount, time and an
          optional UPI reference. Raw notification text and payer details stay
          off our servers.
        </Text>
        <Text style={styles.copy}>
          Notification alerts are best-effort. Formats, battery settings and
          connectivity can prevent delivery. Use a dedicated creator UPI
          account.
        </Text>
        <Button
          title={
            value.notificationAccess
              ? 'Review notification access'
              : 'Open notification access settings'
          }
          color="#477c5d"
          onPress={() => companion.openNotificationSettings()}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Connection diagnostics</Text>
        <Text style={styles.copy}>
          Pairing — {value.paired ? 'Paired' : 'Not paired'}
          {'\n'}Access — {value.notificationAccess ? 'Granted' : 'Not granted'}
          {'\n'}Pending uploads — {value.pending}
          {'\n'}Last successful sync — {value.lastSync || 'Never'}
          {'\n'}Status — {value.lastError || 'Ready'}
        </Text>
        <Button title="Refresh diagnostics" color="#477c5d" onPress={refresh} />
        <Button
          title="Unpair and clear pending events"
          color="#9a6654"
          onPress={async () => {
            await companion.unpair();
            refresh();
          }}
        />
      </View>
    </>
  );
}
