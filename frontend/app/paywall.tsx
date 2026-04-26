import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Check, X, BookOpen, Volume2, Share2, BookHeart, Lock } from 'lucide-react-native';
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
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isFirstPayment = !user?.is_premium;

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
          const sid = new URL(result.url).searchParams.get('session_id');
          if (sid) router.replace({ pathname: '/subscription/success', params: { session_id: sid } });
        }
        setBusy(false);
      }
    } catch (e: any) {
      setError(formatError(e));
      setBusy(false);
    }
  };

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

        {/* Pricing card */}
        <View style={styles.priceCard}>
          {isFirstPayment && (
            <View style={styles.trialBadge}>
              <Sparkles size={11} color={colors.bg} strokeWidth={1.8} />
              <Text style={styles.trialBadgeText}>FIRST 7 DAYS ON US</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$4.99</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          {isFirstPayment ? (
            <View style={styles.breakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Today</Text>
                <Text style={styles.breakdownValueFree}>$0.00</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>After 7-day trial</Text>
                <Text style={styles.breakdownValue}>$4.99 / month</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, styles.breakdownTotal]}>Auto-renews monthly</Text>
                <Text style={[styles.breakdownValue, styles.breakdownTotal]}>Cancel anytime</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.priceNote}>Auto-renews $4.99 every month. Cancel anytime in Manage subscription.</Text>
          )}
        </View>

        {error ? <Text style={styles.error} testID="paywall-error">{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          onPress={onSubscribe}
          disabled={busy}
          testID="paywall-subscribe-btn"
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Lock size={14} color={colors.bg} strokeWidth={1.8} />
              <Text style={styles.primaryBtnText}>
                {isFirstPayment ? 'Start 7-day free trial' : 'Resubscribe · $4.99/month'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.secureRow}>
          <Lock size={11} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.secureText}>Secure payment by Stripe · Cancel anytime</Text>
        </View>

        <Text style={styles.fineprint}>
          {isFirstPayment
            ? "Card required. $0 charged for the first 7 days. After that, $4.99 auto-renews monthly. Cancel anytime in Manage subscription — no charge if you cancel before Day 8."
            : "Your subscription auto-renews $4.99 every month. Cancel or update your card anytime via Manage subscription."}
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
  badgeText: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.8, color: colors.bg },
  title: { fontFamily: fonts.serifBold, fontSize: 38, lineHeight: 44, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: 14 },
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
    marginBottom: 22,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    marginBottom: 12,
  },
  trialBadgeText: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.5, color: colors.bg },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontFamily: fonts.serifBold, fontSize: 48, color: colors.textPrimary, letterSpacing: -1 },
  pricePeriod: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textSecondary, marginLeft: 4 },
  priceNote: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 19 },
  breakdown: { marginTop: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
  breakdownValue: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.textPrimary },
  breakdownValueFree: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.interactive },
  breakdownDivider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  breakdownTotal: { color: colors.textPrimary, fontFamily: fonts.sansSemi },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryBtnText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 14 },
  secureText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  fineprint: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
