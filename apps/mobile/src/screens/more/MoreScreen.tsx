import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { Card, Muted, PrimaryButton, Title } from '../../../components/ui';

/**
 * More — settings & account. Push notification opt-in lives here because
 * Android 13+ requires a runtime request (never ask on first launch).
 */
export function MoreScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const enablePush = async () => {
    const settings = await Notifications.requestPermissionsAsync();
    if (!settings.granted) {
      Alert.alert('Notifications off', 'Enable them in system settings to get payment alerts.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Title>{user?.fullName ?? 'Account'}</Title>
        <Muted>{user?.email}</Muted>
      </Card>

      <Card>
        <Title>Push notifications</Title>
        <Muted>Payment received, low stock, and AI handoff alerts.</Muted>
        <PrimaryButton label="Enable push alerts" onPress={() => void enablePush()} />
      </Card>

      <Card>
        <Title>Session</Title>
        <PrimaryButton
          label="Log out"
          onPress={() =>
            void Alert.alert('Log out', 'Sign out of WCO on this device?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: () => void logout() },
            ])
          }
        />
      </Card>

      <Muted style={styles.version}>WCO Mobile v1.0.0</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12 },
  version: { textAlign: 'center', paddingBottom: 24 },
});
