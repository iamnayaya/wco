import { Platform, Text as RNText, TextProps } from 'react-native';
import { ActivityIndicator, Pressable, TextInput, View, ViewProps } from 'react-native';

/** Minimal mobile UI kit — mirrors the web tokens (emerald brand, slate grays). */

export function Card(props: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: '#e2e8f0',
        },
        props.style,
      ]}
    />
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <RNText style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>{children}</RNText>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <RNText style={{ fontSize: 13, color: '#64748b' }}>{children}</RNText>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#94a3b8"
      style={[
        {
          borderWidth: 1,
          borderColor: '#cbd5e1',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          backgroundColor: '#ffffff',
          color: '#0f172a',
        },
        props.style,
      ]}
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#047857' : '#059669',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {loading ? (
        // iOS spinner renders white; Android needs explicit color
        <ActivityIndicator color={Platform.OS === 'ios' ? '#ffffff' : '#059669'} />
      ) : (
        <RNText style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>{label}</RNText>
      )}
    </Pressable>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <RNText style={{ fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
        {label}
      </RNText>
      <RNText style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 2 }}>{value}</RNText>
    </Card>
  );
}
