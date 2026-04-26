import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Bell, Heart, BookOpen, ChevronRight } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';

export default function Settings() {
  const { user, logout } = useAuth();
  const [dailyOn, setDailyOn] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          if (Platform.OS !== 'web') {
            Alert.alert('Permission needed', 'Please enable notifications in your device settings.');
          }
          setDailyOn(false);
          return;
        }
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'A verse for today 🌅',
            body: 'Open His Word to read today\'s verse.',
          },
          trigger: { hour: 8, minute: 0, repeats: true } as any,
        });
        setDailyOn(true);
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        setDailyOn(false);
      }
    } catch (e) {
      setDailyOn(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR SANCTUARY</Text>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile card */}
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

        {/* Sections */}
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
            thumbColor={dailyOn ? colors.bg : colors.bg}
            testID="daily-notification-switch"
          />
        </View>

        <View style={styles.row}>
          <BookOpen size={18} color={colors.textPrimary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Bible translation</Text>
            <Text style={styles.rowSub}>NIV — New International Version</Text>
          </View>
          <ChevronRight size={18} color={colors.textDisabled} strokeWidth={1.5} />
        </View>

        <View style={styles.row}>
          <Heart size={18} color={colors.textPrimary} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>About His Word</Text>
            <Text style={styles.rowSub}>A Bible verse companion for every season.</Text>
          </View>
        </View>

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
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
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
