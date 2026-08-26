import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { Card, Input, PrimaryButton, Title } from '../../../components/ui';

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // RootNavigator flips to Main automatically via the store
    } catch (error) {
      const message =
        // axios error with response body
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Check your connection and try again.';
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.center}>
        <Card style={styles.card}>
          <Title>Log in to WCO</Title>
          <Input
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@business.com"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            secureTextEntry
            autoComplete="password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton label="Log in" onPress={onSubmit} loading={loading} />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { gap: 12 },
});
