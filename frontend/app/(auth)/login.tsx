import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.back}
            onPress={() => router.back()}
            testID="login-back-btn"
          >
            <ChevronLeft size={26} color={colors.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to return to your verses and history.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textDisabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-email-input"
            />

            <Text style={[styles.label, { marginTop: 20 }]}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry
              testID="login-password-input"
            />

            {error ? (
              <Text style={styles.error} testID="login-error">{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
              testID="login-submit-btn"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={() => router.replace('/(auth)/signup')}
              testID="login-go-signup"
            >
              <Text style={styles.linkText}>
                New here?  <Text style={styles.linkAccent}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 28, paddingBottom: 40 },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -8, marginTop: 4 },
  header: { marginTop: 24, marginBottom: 36 },
  title: { fontFamily: fonts.serifBold, fontSize: 40, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.textSecondary, marginTop: 8, lineHeight: 24 },
  form: {},
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textPrimary,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.sans,
    fontSize: 14,
    marginTop: 16,
  },
  btn: {
    marginTop: 32,
    backgroundColor: colors.interactive,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnText: { color: colors.interactiveText, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  link: { marginTop: 22, alignItems: 'center' },
  linkText: { fontFamily: fonts.sans, color: colors.textSecondary, fontSize: 15 },
  linkAccent: { color: colors.textPrimary, fontFamily: fonts.sansMedium },
});
