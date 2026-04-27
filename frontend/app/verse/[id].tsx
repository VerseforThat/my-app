import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import { api, formatError, VerseMatch } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import VersePlayer from '../../src/VersePlayer';
import { shareVerse } from '../../src/share';

export default function VerseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<VerseMatch | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [shareToast, setShareToast] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<VerseMatch>(`/verses/${id}`);
      setMatch(res.data);
      try {
        const favs = await api.get<VerseMatch[]>('/favorites');
        setFavorited(!!favs.data.find((f) => f.id === id));
      } catch {}
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onToggleFav = async () => {
    if (!match || savingFav) return;
    setSavingFav(true);
    try {
      if (!favorited) {
        await api.post('/favorites', { match_id: match.id });
        setFavorited(true);
      } else {
        await api.delete(`/favorites/${match.id}`);
        setFavorited(false);
      }
    } catch {} finally { setSavingFav(false); }
  };

  const onShare = async () => {
    if (!match) return;
    const ok = await shareVerse(match.reference, match.verse_text);
    if (ok && Platform.OS === 'web') {
      setShareToast('Copied to clipboard');
      setTimeout(() => setShareToast(''), 1800);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></SafeAreaView>;
  }
  if (error || !match) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Verse not found.'}</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={10} testID="verse-back">
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={1.6} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {!!match.problem && <Text style={styles.problem}>"{match.problem}"</Text>}

        <Text style={styles.verseText} testID="verse-detail-text">{match.verse_text}</Text>
        <Text style={styles.verseRef}>— {match.reference}</Text>

        {!!match.explanation && (
          <>
            <View style={styles.divider} />
            <Text style={styles.reflectionLabel}>A REFLECTION</Text>
            <Text style={styles.reflection}>{match.explanation}</Text>
          </>
        )}

        <View style={{ height: 24 }} />
        <VersePlayer text={`${match.verse_text}. ${match.explanation || ''}`} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, favorited && styles.btnActive]}
            onPress={onToggleFav}
            disabled={savingFav}
            testID="verse-detail-fav-btn"
          >
            <Heart
              size={16}
              color={favorited ? colors.interactiveText : colors.textPrimary}
              fill={favorited ? colors.interactiveText : 'transparent'}
              strokeWidth={1.8}
            />
            <Text style={[styles.btnText, favorited && { color: colors.interactiveText }]}>
              {favorited ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={onShare} testID="verse-detail-share-btn">
            <Share2 size={16} color={colors.textPrimary} strokeWidth={1.8} />
            <Text style={styles.btnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {!!shareToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{shareToast}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 24, gap: 4 },
  backText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  backLink: { fontFamily: fonts.sansMedium, color: colors.accent, marginTop: 12 },
  error: { fontFamily: fonts.sans, color: colors.error },
  problem: { fontFamily: fonts.sans, fontStyle: 'italic', fontSize: 14, color: colors.textSecondary, marginBottom: 24, lineHeight: 22 },
  verseText: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.2 },
  verseRef: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent, letterSpacing: 0.5, marginTop: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 28 },
  reflectionLabel: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2.5, color: colors.accent, marginBottom: 12 },
  reflection: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 27, color: colors.textAccent },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.interactive },
  btnActive: { backgroundColor: colors.interactive },
  btnText: { fontFamily: fonts.sansMedium, color: colors.textPrimary, fontSize: 15 },
  toast: { alignSelf: 'center', backgroundColor: colors.textPrimary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.pill, marginTop: 16 },
  toastText: { color: colors.textOnDark, fontFamily: fonts.sansMedium, fontSize: 13 },
});
