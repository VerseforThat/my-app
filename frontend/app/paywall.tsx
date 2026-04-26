import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Check, X, BookOpen, Volume2, Share2, BookHeart } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { api, formatError } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { colors, fonts, radii } from '../src/theme';

const FEATURES = [
  { icon: Sparkles, label: 'Unlimited verse matches' },
  { icon: BookOpen, label: 'Read more context — surrounding verses' },
  { icon: Volume2, label: 'Voice readings by David, British storyteller' },
  { icon: BookHeart, label: 'Unlimited saved favorites & history' },
  { icon: Share2, label: 'Share verses with friends' },
];

export default function Paywall() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onStartTrial = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/subscription/start-trial');
      await refreshUser();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubscribe = async () => {
    setError('');
    setBusy(true);
    try {
      const origin = Platform.OS === 'web'
        ? (globalThis as any).location.origin
        : process.env.EXPO_PUBLIC_BACKEND_URL;
      const res = await api.post('/subscription/checkout', { origin_url: origin });
      const url: string = res.data.url;
      if (Platform.OS === 'web') {
        (globalThis as any).location.href = url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(url, `${origin}/subscription/success`);
        if (result.type === 'success' && result.url) {
          // parse session_id and refresh user
          const sid = new URL(result.url).searchParams.get('session_id');
          if (sid) router.replace({ pathname: '/subscription/success', params: { session_id: sid } });
        }
      }
    } catch (e: any) {
      setError(formatError(e));
      setBusy(false);
    }
  };

  const trialUsed = user?.subscription_status !== 'free';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.close}
          onPress={() => router.back()}
          testID="paywall-close-btn"
          hitSlop={10}
        >
          <X size={24} color={colors.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Sparkles size={14} color={colors.bg} strokeWidth={1.8} />
            <Text style={styles.badgeText}>HIS WORD PREMIUM</Text>
          </View>
          <Text style={styles.title}>Continue your{'\n'}journey, unbound.</Text>
          {reason === 'limit' ? (
            <Text style={styles.subtitle}>
              You've used all 3 free verses. Step into premium for unlimited guidance.
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Unlock every verse, every reflection, every time you need it.
            </Text>
          )}
        </View>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Check size={14} color={colors.bg} strokeWidth={2.5} />
              </View>
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceEyebrow}>7-DAY FREE TRIAL · THEN</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$4.99</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          <Text style={styles.priceNote}>Cancel anytime. No hidden fees.</Text>
        </View>

        {error ? <Text style={styles.error} testID="paywall-error">{error}</Text> : null}

        {!trialUsed && (
          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={onStartTrial}
            disabled={busy}
            testID="paywall-start-trial-btn"
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Start 7-day free trial</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            trialUsed ? styles.primaryBtn : styles.secondaryBtn,
            busy && { opacity: 0.6 },
          ]}
          onPress={onSubscribe}
          disabled={busy}
          testID="paywall-subscribe-btn"
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={trialUsed ? colors.bg : colors.textPrimary} />
          ) : (
            <Text style={trialUsed ? styles.primaryBtnText : styles.secondaryBtnText}>
              Subscribe — $4.99/month
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.fineprint}>
          Subscription extends premium access by 30 days per payment. Renew when ready — no auto-charge.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 28, paddingBottom: 48 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
  hero: { marginTop: 16, marginBottom: 32 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    marginBottom: 18,
  },
  badgeText: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.bg,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 38,
    lineHeight: 44,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 14,
  },
  features: { marginBottom: 28, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary, flex: 1 },
  priceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 22,
  },
  priceEyebrow: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  priceAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 48,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  pricePeriod: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textSecondary, marginLeft: 4 },
  priceNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  secondaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  fineprint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
  },
});
