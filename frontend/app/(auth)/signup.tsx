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
import BotanicalBackground from '../../src/BotanicalBackground';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';

export default function Signup() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, name || undefined);
    } catch (e: any) {
      setError(e.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BotanicalBackground />
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
            testID="signup-back-btn"
          >
            <ChevronLeft size={26} color={colors.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Begin{'\n'}your journey</Text>
            <Text style={styles.subtitle}>
              Save the verses that move you and revisit them whenever you need.
            </Text>
          </View>

          <View>
            <Text style={styles.label}>NAME (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="What should we call you?"
              placeholderTextColor={colors.textDisabled}
              testID="signup-name-input"
            />

            <Text style={[styles.label, { marginTop: 20 }]}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textDisabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="signup-email-input"
            />

            <Text style={[styles.label, { marginTop: 20 }]}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry
              testID="signup-password-input"
            />

            {error ? (
              <Text style={styles.error} testID="signup-error">{error}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
              testID="signup-submit-btn"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnText}>Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={() => router.replace('/(auth)/login')}
              testID="signup-go-login"
            >
              <Text style={styles.linkText}>
                Already have an account?  <Text style={styles.linkAccent}>Sign in</Text>
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
  title: { fontFamily: fonts.serifBold, fontSize: 40, lineHeight: 46, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.textSecondary, marginTop: 12, lineHeight: 24 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.textSecondary, marginBottom: 10 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textPrimary,
  },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 14, marginTop: 16 },
  btn: { marginTop: 32, backgroundColor: colors.interactive, borderRadius: radii.pill, paddingVertical: 18, alignItems: 'center' },
  btnText: { color: colors.interactiveText, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  link: { marginTop: 22, alignItems: 'center' },
  linkText: { fontFamily: fonts.sans, color: colors.textSecondary, fontSize: 15 },
  linkAccent: { color: colors.textPrimary, fontFamily: fonts.sansMedium },
});
