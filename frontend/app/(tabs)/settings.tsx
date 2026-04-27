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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  Bell,
  Heart,
  BookOpen,
  Check,
  ChevronRight,
  X,
  Volume2,
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/AuthContext';
import { api, formatError } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import { getItem, setItem } from '../../src/storage';
import { isMuted as isSplashMuted, setMuted as setSplashMuted } from '../../src/splashSound';

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

// "About" copy ------------------------------------------------------------
const ABOUT_PREVIEW = 'Life gets hard. Sometimes you\'re anxious, overwhelmed, grieving, or just feeling lost — and you need something to hold onto right now.';
const ABOUT_FULL = `Life gets hard. Sometimes you're anxious, overwhelmed, grieving, or just feeling lost — and you need something to hold onto right now.

Tell us what you're going through, in your own words, and we'll find the Bible verse that speaks directly to that moment — along with a quiet reflection on what it means and why it might help.

You don't need to be religious. You don't need to know anything about the Bible. You just need to be honest about what you're feeling.

Whoever you are, there's a verse for that.`;

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const [dailyOn, setDailyOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [splashSoundOn, setSplashSoundOn] = useState(true);

  // Restore daily-notification toggle state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem(DAILY_NOTIF_KEY);
        if (saved === '1') setDailyOn(true);
      } catch {}
      try {
        const muted = await isSplashMuted();
        setSplashSoundOn(!muted);
      } catch {}
    })();
  }, []);

  const onToggleSplashSound = async (value: boolean) => {
    setSplashSoundOn(value);
    try {
      await setSplashMuted(!value);
    } catch {}
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
                      <ActivityIndicator size="small" color={colors.interactiveText} />
                    ) : (
                      <Check size={14} color={colors.interactiveText} strokeWidth={2.5} />
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

        {Platform.OS !== 'web' && (
          <View style={styles.row} testID="setting-splash-sound">
            <Volume2 size={18} color={colors.textPrimary} strokeWidth={1.5} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Opening ambient sound</Text>
              <Text style={styles.rowSub}>A soft tone when you open the app. Respects your device's silent switch.</Text>
            </View>
            <Switch
              value={splashSoundOn}
              onValueChange={onToggleSplashSound}
              trackColor={{ false: colors.surface, true: colors.interactive }}
              thumbColor={colors.bg}
              testID="splash-sound-switch"
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.row}
          onPress={() => setAboutOpen(true)}
          activeOpacity={0.7}
          testID="about-row"
        >
          <Heart size={18} color={colors.textPrimary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>About Verse for That</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {ABOUT_PREVIEW} <Text style={styles.readMore}>Read more</Text>
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.5} />
        </TouchableOpacity>

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

      {/* About modal */}
      <Modal
        visible={aboutOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAboutOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>About Verse for That</Text>
            <TouchableOpacity
              onPress={() => setAboutOpen(false)}
              style={styles.modalClose}
              testID="about-close"
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={colors.textPrimary} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.aboutBody}>{ABOUT_FULL}</Text>
            <View style={styles.aboutDivider} />
            <Text style={styles.aboutFootnote}>
              "Your word is a lamp for my feet, a light on my path."{'\n'}— Psalm 119:105
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    backgroundColor: colors.interactive,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.interactiveText },
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
    borderColor: colors.interactive,
    backgroundColor: colors.surfaceElevated,
  },
  transLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  checkDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.interactive,
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
  readMore: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.interactive },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 13, marginTop: 8 },
  // About modal
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.3 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalScroll: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 60 },
  aboutBody: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  aboutFootnote: {
    fontFamily: fonts.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
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
