import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  LogOut,
  Bell,
  Heart,
  BookOpen,
  Sparkles,
  Crown,
  Check,
  ExternalLink,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/AuthContext';
import { api, formatError } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import { getItem, setItem } from '../../src/storage';

const DAILY_NOTIF_KEY = 'daily_notif_enabled';
const DAILY_NOTIF_ID_KEY = 'daily_notif_id';
const DAILY_HOUR = 8;
const DAILY_MINUTE = 0;

const TRANSLATIONS = ['NIV', 'KJV'] as const;
type Translation = typeof TRANSLATIONS[number];

const TRANSLATION_LABEL: Record<Translation, string> = {
  NIV: 'NIV — New International Version',
  KJV: 'KJV — King James Version',
};

export default function Settings() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [dailyOn, setDailyOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [portalBusy, setPortalBusy] = useState(false);

  // Restore daily-notification toggle state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem(DAILY_NOTIF_KEY);
        if (saved === '1') setDailyOn(true);
      } catch {}
    })();
  }, []);

  const onManageSubscription = async () => {
    if (!user?.is_premium) {
      router.push('/paywall');
      return;
    }
    setPortalBusy(true);
    try {
      const origin = Platform.OS === 'web'
        ? (globalThis as any).location.origin
        : process.env.EXPO_PUBLIC_BACKEND_URL;
      const res = await api.post('/subscription/portal', { origin_url: origin });
      const url: string = res.data.url;
      if (Platform.OS === 'web') {
        (globalThis as any).location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (e: any) {
      Alert.alert('Could not open billing portal', formatError(e));
    } finally {
      setPortalBusy(false);
    }
  };

  const onConfirmLogout = () => {
    if (Platform.OS === 'web') {
      logout();
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const onToggleDaily = async (value: boolean) => {
    if (Platform.OS === 'web') {
      // Local notifications aren't reliable on web; just inform the user.
      Alert.alert?.(
        'Use the mobile app',
        'Daily verse reminders are delivered through the mobile app. Open Verse for That on your phone to enable.'
      );
      return;
    }
    setBusy(true);
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please enable notifications in your device settings.');
          setDailyOn(false);
          return;
        }
        // Cancel any prior reminders so we never stack duplicates
        await Notifications.cancelAllScheduledNotificationsAsync();

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'A verse for today 🌅',
            body: 'Open Verse for That to read today\'s verse.',
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: DAILY_HOUR,
            minute: DAILY_MINUTE,
          } as any,
        });
        await setItem(DAILY_NOTIF_KEY, '1');
        await setItem(DAILY_NOTIF_ID_KEY, id);
        setDailyOn(true);
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await setItem(DAILY_NOTIF_KEY, '0');
        setDailyOn(false);
      }
    } catch (e) {
      console.warn('Daily notif toggle failed', e);
      setDailyOn(false);
    } finally {
      setBusy(false);
    }
  };

  const onPickTranslation = async (t: Translation) => {
    if (translationBusy || user?.bible_translation === t) return;
    setTranslationBusy(true);
    setTranslationError('');
    try {
      await api.patch('/settings/translation', { translation: t });
      await refreshUser();
    } catch (e: any) {
      setTranslationError(formatError(e));
    } finally {
      setTranslationBusy(false);
    }
  };

  const planLabel = (() => {
    if (!user) return '';
    if (user.subscription_status === 'trialing') {
      const end = user.current_period_end ? new Date(user.current_period_end) : null;
      return end ? `Trial · ends ${end.toLocaleDateString()}` : 'Free trial active';
    }
    if (user.subscription_status === 'active') {
      const end = user.current_period_end ? new Date(user.current_period_end) : null;
      const renewLabel = (user as any).cancel_at_period_end ? 'ends' : 'renews';
      return end ? `Premium · ${renewLabel} ${end.toLocaleDateString()}` : 'Premium';
    }
    if (user.subscription_status === 'past_due') {
      return 'Premium · payment past due';
    }
    return `Free · ${user.free_verses_remaining} of 3 verses left`;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR SANCTUARY</Text>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile */}
        <View style={styles.profileCard} testID="profile-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name || 'Friend'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Subscription card */}
        <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
        <View
          style={[styles.subCard, user?.is_premium && styles.subCardPremium]}
          testID="subscription-card"
        >
          <View style={styles.subRow}>
            <View style={[styles.subIcon, user?.is_premium && { backgroundColor: colors.bg }]}>
              {user?.is_premium ? (
                <Crown size={18} color={colors.interactive} strokeWidth={1.6} fill={colors.interactive} />
              ) : (
                <Sparkles size={18} color={colors.bg} strokeWidth={1.6} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subPlan, user?.is_premium && { color: colors.bg }]}>
                {user?.is_premium ? 'Verse for That Premium' : 'Free plan'}
              </Text>
              <Text style={[styles.subStatus, user?.is_premium && { color: 'rgba(250,249,246,0.85)' }]}>
                {planLabel}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.subBtn, user?.is_premium && styles.subBtnLight, portalBusy && { opacity: 0.6 }]}
            onPress={onManageSubscription}
            disabled={portalBusy}
            testID="manage-subscription-btn"
            activeOpacity={0.85}
          >
            {portalBusy ? (
              <ActivityIndicator color={user?.is_premium ? colors.textPrimary : colors.bg} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.subBtnText, user?.is_premium && { color: colors.textPrimary }]}>
                  {user?.is_premium ? 'Manage subscription' : 'Upgrade · 7-day free trial'}
                </Text>
                {user?.is_premium && (
                  <ExternalLink size={14} color={colors.textPrimary} strokeWidth={1.6} />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Bible translation */}
        <Text style={styles.sectionLabel}>BIBLE TRANSLATION</Text>
        <View style={styles.transWrap}>
          {TRANSLATIONS.map((t) => {
            const active = user?.bible_translation === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.transRow, active && styles.transRowActive]}
                onPress={() => onPickTranslation(t)}
                disabled={translationBusy}
                testID={`translation-${t.toLowerCase()}`}
                activeOpacity={0.8}
              >
                <BookOpen size={18} color={colors.textPrimary} strokeWidth={1.5} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.transLabel}>{TRANSLATION_LABEL[t]}</Text>
                </View>
                {active && (
                  <View style={styles.checkDot}>
                    {translationBusy ? (
                      <ActivityIndicator size="small" color={colors.bg} />
                    ) : (
                      <Check size={14} color={colors.bg} strokeWidth={2.5} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {!!translationError && <Text style={styles.error}>{translationError}</Text>}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>

        <View style={styles.row} testID="setting-daily-notification">
          <Bell size={18} color={colors.textPrimary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Daily verse reminder</Text>
            <Text style={styles.rowSub}>Receive a gentle nudge each morning at 8 AM.</Text>
          </View>
          <Switch
            value={dailyOn}
            onValueChange={onToggleDaily}
            disabled={busy}
            trackColor={{ false: colors.surface, true: colors.interactive }}
            thumbColor={colors.bg}
            testID="daily-notification-switch"
          />
        </View>

        <View style={styles.row}>
          <Heart size={18} color={colors.textPrimary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>About Verse for That</Text>
            <Text style={styles.rowSub}>A Bible verse companion for every season.</Text>
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>

        <TouchableOpacity
          style={[styles.row, styles.logoutRow]}
          onPress={onConfirmLogout}
          testID="logout-btn"
          activeOpacity={0.7}
        >
          <LogOut size={18} color={colors.error} strokeWidth={1.5} />
          <Text style={[styles.rowTitle, { color: colors.error }]}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>"Your word is a lamp for my feet, a light on my path."{'\n'}— Psalm 119:105</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { paddingTop: 20, marginBottom: 24 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 2.5, color: colors.textSecondary },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.textPrimary, letterSpacing: -0.5, marginTop: 4 },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.bg },
  profileName: { fontFamily: fonts.sansSemi, fontSize: 18, color: colors.textPrimary },
  profileEmail: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 12,
  },
  subCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subCardPremium: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  subIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  subPlan: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.textPrimary },
  subStatus: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  subBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subBtnLight: { backgroundColor: colors.bg },
  subBtnText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 14, letterSpacing: 0.3 },
  transWrap: { marginBottom: 28 },
  transRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transRowActive: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.bg,
  },
  transLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  checkDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutRow: { borderColor: colors.error + '33' },
  rowTitle: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  rowSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 13, marginTop: 8 },
  footer: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 36,
    lineHeight: 22,
  },
});
