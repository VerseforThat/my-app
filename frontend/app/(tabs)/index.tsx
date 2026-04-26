import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Sparkles, Sunrise } from 'lucide-react-native';
import { api, formatError, VerseMatch, DailyVerse } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';
import VersePlayer from '../../src/VersePlayer';

export default function Home() {
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<VerseMatch | null>(null);
  const [error, setError] = useState('');
  const [favorited, setFavorited] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [daily, setDaily] = useState<DailyVerse | null>(null);

  useEffect(() => {
    api
      .get<DailyVerse>('/daily-verse')
      .then((res) => setDaily(res.data))
      .catch(() => {});
  }, []);

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (problem.trim().length < 3) {
      setError('Please share a few words about how you feel.');
      return;
    }
    setError('');
    setLoading(true);
    setMatch(null);
    setFavorited(false);
    try {
      const res = await api.post<VerseMatch>('/verses/match', { problem: problem.trim() });
      setMatch(res.data);
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const onFavorite = async () => {
    if (!match || favorited) return;
    setSavingFav(true);
    try {
      await api.post('/favorites', { match_id: match.id });
      setFavorited(true);
    } catch {
      // ignore
    } finally {
      setSavingFav(false);
    }
  };

  const onNew = () => {
    setMatch(null);
    setProblem('');
    setError('');
    setFavorited(false);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.greeting}>
                {greeting}{user?.name ? `, ${user.name}` : ''}
              </Text>
              <Text style={styles.brand} testID="home-brand">His Word</Text>
            </View>

            {!match && (
              <>
                {/* Daily verse */}
                {daily && (
                  <View style={styles.dailyCard} testID="daily-verse-card">
                    <View style={styles.dailyHeader}>
                      <Sunrise size={14} color={colors.accent} strokeWidth={1.6} />
                      <Text style={styles.dailyEyebrow}>VERSE OF THE DAY</Text>
                    </View>
                    <Text style={styles.dailyVerse}>{daily.verse_text}</Text>
                    <Text style={styles.dailyRef}>— {daily.reference}</Text>
                  </View>
                )}

                {/* Prompt */}
                <View style={styles.promptSection}>
                  <Text style={styles.promptTitle}>What weighs{'\n'}on your heart today?</Text>
                  <Text style={styles.promptHelp}>
                    Share anything — a fear, a question, a quiet ache. We'll meet you with a verse.
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={problem}
                    onChangeText={setProblem}
                    placeholder="I feel overwhelmed by..."
                    placeholderTextColor={colors.textDisabled}
                    multiline
                    textAlignVertical="top"
                    testID="home-problem-input"
                  />

                  {error ? (
                    <Text style={styles.error} testID="home-error">{error}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                    onPress={onSubmit}
                    disabled={loading}
                    testID="home-submit-btn"
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.bg} />
                    ) : (
                      <>
                        <Sparkles size={16} color={colors.bg} strokeWidth={1.6} />
                        <Text style={styles.submitBtnText}>Find my verse</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {match && (
              <View style={styles.resultSection} testID="verse-result">
                <Text style={styles.youSaid} numberOfLines={2}>
                  "{match.problem}"
                </Text>

                <Text style={styles.verseText} testID="verse-text-display">
                  {match.verse_text}
                </Text>
                <Text style={styles.verseRef} testID="verse-reference">
                  — {match.reference}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.explanationLabel}>A REFLECTION</Text>
                <Text style={styles.explanation} testID="verse-explanation-text">
                  {match.explanation}
                </Text>

                <View style={{ height: 24 }} />
                <VersePlayer text={`${match.verse_text}. ${match.explanation}`} />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.favBtn, favorited && styles.favBtnActive]}
                    onPress={onFavorite}
                    disabled={savingFav || favorited}
                    testID="verse-favorite-btn"
                    activeOpacity={0.8}
                  >
                    <Heart
                      size={16}
                      color={favorited ? colors.bg : colors.textPrimary}
                      strokeWidth={1.8}
                      fill={favorited ? colors.bg : 'transparent'}
                    />
                    <Text style={[styles.favBtnText, favorited && { color: colors.bg }]}>
                      {favorited ? 'Saved' : 'Save verse'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.newBtn}
                    onPress={onNew}
                    testID="verse-new-btn"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.newBtnText}>Ask another</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { paddingTop: 16, marginBottom: 28 },
  greeting: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  brand: {
    fontFamily: fonts.serifBold,
    fontSize: 36,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  dailyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 22,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dailyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dailyEyebrow: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
  },
  dailyVerse: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  dailyRef: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
  },
  promptSection: { marginTop: 8 },
  promptTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 38,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  promptHelp: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 22,
    minHeight: 160,
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 14, marginTop: 12 },
  submitBtn: {
    marginTop: 22,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitBtnText: {
    color: colors.bg,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  resultSection: { paddingTop: 4 },
  youSaid: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  verseText: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 38,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  verseRef: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.accent,
    letterSpacing: 0.5,
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  explanationLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
    marginBottom: 12,
  },
  explanation: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 27,
    color: colors.interactive,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 32 },
  favBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  favBtnActive: {
    backgroundColor: colors.textPrimary,
  },
  favBtnText: { fontFamily: fonts.sansMedium, color: colors.textPrimary, fontSize: 15 },
  newBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  newBtnText: { fontFamily: fonts.sansMedium, color: colors.textPrimary, fontSize: 15 },
});
