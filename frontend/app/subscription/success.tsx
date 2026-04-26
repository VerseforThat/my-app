import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';

const POLL_MAX = 8;

export default function SubscriptionSuccess() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!session_id) {
      setStatus('failed');
      return;
    }
    let cancelled = false;
    let count = 0;

    const poll = async () => {
      if (cancelled) return;
      count += 1;
      setAttempts(count);
      try {
        const res = await api.get(`/subscription/status/${session_id}`);
        const ps = res.data.payment_status;
        if (ps === 'paid') {
          setStatus('paid');
          await refreshUser();
          return;
        }
        if (res.data.status === 'expired') {
          setStatus('failed');
          return;
        }
      } catch {
        // continue
      }
      if (count >= POLL_MAX) {
        setStatus('failed');
        return;
      }
      setTimeout(poll, 2000);
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        {status === 'pending' && (
          <>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.title}>Confirming your payment…</Text>
            <Text style={styles.sub}>Attempt {attempts} of {POLL_MAX}</Text>
          </>
        )}
        {status === 'paid' && (
          <>
            <View style={styles.checkCircle}>
              <Check size={36} color={colors.bg} strokeWidth={2.5} />
            </View>
            <Text style={styles.title}>Welcome to premium</Text>
            <Text style={styles.sub}>Verse for That is now yours, unlimited.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace('/(tabs)')}
              testID="success-continue-btn"
            >
              <Text style={styles.btnText}>Open the app</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'failed' && (
          <>
            <Text style={styles.title}>Payment not completed</Text>
            <Text style={styles.sub}>You haven't been charged. Try again when you're ready.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace('/(tabs)')}
              testID="success-back-btn"
            >
              <Text style={styles.btnText}>Back to app</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  checkCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.interactive,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.textPrimary, marginTop: 24, textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
  btn: {
    marginTop: 32,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: 36,
    paddingVertical: 16,
  },
  btnText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 15 },
});
