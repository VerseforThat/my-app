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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, Sparkles, Sunrise, Share2, BookOpen, X, Lock } from 'lucide-react-native';
import { api, formatError, VerseMatch, DailyVerse } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';
import VersePlayer from '../../src/VersePlayer';
import { shareVerse } from '../../src/share';

const QUICK_PROMPTS = [
  'Fear of being alone',
  'Financial stress',
  'Low self-esteem',
  'Depression',
  'Questioning everything',
];

export default function Home() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<VerseMatch | null>(null);
  const [error, setError] = useState('');
  const [favorited, setFavorited] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [daily, setDaily] = useState<DailyVerse | null>(null);
  const [shareToast, setShareToast] = useState('');

  // Context modal
  const [contextOpen, setContextOpen] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextData, setContextData] = useState<{ reference: string; context_text: string } | null>(null);
  const [contextError, setContextError] = useState('');

  useEffect(() => {
    api.get<DailyVerse>('/daily-verse').then((res) => setDaily(res.data)).catch(() => {});
  }, []);

  const submit = async (text: string) => {
    Keyboard.dismiss();
    if (text.trim().length < 3) {
      setError('Please share a few words about how you feel.');
      return;
    }
    setError('');
    setLoading(true);
    setMatch(null);
    setFavorited(false);
    try {
      const res = await api.post<VerseMatch>('/verses/match', { problem: text.trim() });
      setMatch(res.data);
      await refreshUser();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 402 && detail?.error === 'free_limit_reached') {
        router.push({ pathname: '/paywall', params: { reason: 'limit' } });
      } else {
        setError(formatError(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const onChipPress = (prompt: string) => {
    setProblem(prompt);
    submit(prompt);
  };

  const onFavorite = async () => {
    if (!match || favorited) return;
    setSavingFav(true);
    try {
      await api.post('/favorites', { match_id: match.id });
      setFavorited(true);
    } catch {}
    finally { setSavingFav(false); }
  };

  const onShare = async () => {
    if (!match) return;
    const ok = await shareVerse(match.reference, match.verse_text);
    if (ok && Platform.OS === 'web') {
      setShareToast('Copied to clipboard');
      setTimeout(() => setShareToast(''), 1800);
    }
  };

  const onMoreContext = async () => {
    if (!match) return;
    if (!user?.is_premium) {
      router.push({ pathname: '/paywall', params: { reason: 'context' } });
      return;
    }
    setContextOpen(true);
    setContextData(null);
    setContextError('');
    setContextLoading(true);
    try {
      const res = await api.get(`/verses/${match.id}/context`);
      setContextData(res.data);
    } catch (e: any) {
      setContextError(formatError(e));
    } finally {
      setContextLoading(false);
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

  const quotaText = user
    ? user.is_premium
      ? user.subscription_status === 'trialing'
        ? 'Free trial active'
        : 'Premium'
      : `${user.free_verses_remaining} of 3 free verses left`
    : '';

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
            <View style={styles.header}>
              <Text style={styles.greeting}>
                {greeting}{user?.name ? `, ${user.name}` : ''}
              </Text>
              <View style={styles.brandRow}>
                <Text style={styles.brand} testID="home-brand">Verse for That</Text>
                {!!quotaText && (
                  <View style={[
                    styles.quotaPill,
                    user?.is_premium && styles.quotaPillPremium,
                  ]} testID="quota-pill">
                    <Text style={[
                      styles.quotaText,
                      user?.is_premium && { color: colors.bg },
                    ]}>{quotaText}</Text>
                  </View>
                )}
              </View>
            </View>

            {!match && (
              <>
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

                <View style={styles.promptSection}>
                  <Text style={styles.promptTitle}>What's the problem{'\n'}you're trying to{'\n'}work through?</Text>

                  <TextInput
                    style={[styles.input, { marginTop: 22 }]}
                    value={problem}
                    onChangeText={setProblem}
                    placeholder="I feel overwhelmed by..."
                    placeholderTextColor={colors.textDisabled}
                    multiline
                    textAlignVertical="top"
                    testID="home-problem-input"
                  />

                  {error ? <Text style={styles.error} testID="home-error">{error}</Text> : null}

                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                    onPress={() => submit(problem)}
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

                  <Text style={styles.promptHelp}>
                    Tap one of the options below or describe it in your own words.
                  </Text>

                  <View style={styles.chips}>
                    {QUICK_PROMPTS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.chip}
                        onPress={() => onChipPress(p)}
                        disabled={loading}
                        testID={`chip-${p.toLowerCase().replace(/\s+/g, '-')}`}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipText}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {match && (
              <View style={styles.resultSection} testID="verse-result">
                <Text style={styles.youSaid} numberOfLines={2}>"{match.problem}"</Text>

                <Text style={styles.verseText} testID="verse-text-display">{match.verse_text}</Text>
                <Text style={styles.verseRef} testID="verse-reference">— {match.reference}</Text>

                <View style={styles.divider} />

                <Text style={styles.explanationLabel}>A REFLECTION</Text>
                <Text style={styles.explanation} testID="verse-explanation-text">{match.explanation}</Text>

                <View style={{ height: 24 }} />
                <VersePlayer text={`${match.verse_text}. ${match.explanation}`} />

                <TouchableOpacity
                  style={styles.contextBtn}
                  onPress={onMoreContext}
                  testID="verse-more-context-btn"
                  activeOpacity={0.8}
                >
                  <BookOpen size={16} color={colors.textPrimary} strokeWidth={1.5} />
                  <Text style={styles.contextBtnText}>Read more context</Text>
                  {!user?.is_premium && (
                    <View style={styles.lockTag}>
                      <Lock size={10} color={colors.bg} strokeWidth={2} />
                      <Text style={styles.lockTagText}>PREMIUM</Text>
                    </View>
                  )}
                </TouchableOpacity>

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
                      {favorited ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={onShare}
                    testID="verse-share-btn"
                    activeOpacity={0.8}
                  >
                    <Share2 size={16} color={colors.textPrimary} strokeWidth={1.8} />
                    <Text style={styles.favBtnText}>Share</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.newBtn}
                  onPress={onNew}
                  testID="verse-new-btn"
                  activeOpacity={0.7}
                >
                  <Text style={styles.newBtnText}>Ask another</Text>
                </TouchableOpacity>

                {!!shareToast && (
                  <View style={styles.toast} testID="share-toast">
                    <Text style={styles.toastText}>{shareToast}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Context Modal */}
      <Modal
        visible={contextOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setContextOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Surrounding Context</Text>
            <TouchableOpacity
              onPress={() => setContextOpen(false)}
              hitSlop={10}
              testID="context-close-btn"
            >
              <X size={26} color={colors.textPrimary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {contextLoading && (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.modalLoading}>Loading the wider passage…</Text>
              </View>
            )}
            {contextError ? (
              <Text style={styles.error} testID="context-error">{contextError}</Text>
            ) : null}
            {contextData && (
              <>
                <Text style={styles.modalRef} testID="context-ref">{contextData.reference}</Text>
                <Text style={styles.modalContext} testID="context-text">
                  {contextData.context_text}
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  header: { paddingTop: 16, marginBottom: 28 },
  greeting: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, letterSpacing: 0.3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  brand: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5, flex: 1 },
  quotaPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quotaPillPremium: { backgroundColor: colors.interactive, borderColor: colors.interactive },
  quotaText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
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
  dailyEyebrow: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2.5, color: colors.accent },
  dailyVerse: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 30, color: colors.textPrimary },
  dailyRef: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginTop: 12 },
  promptSection: { marginTop: 8 },
  promptTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 38,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  promptHelp: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 12, marginBottom: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 22,
    minHeight: 140,
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
  submitBtnText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  resultSection: { paddingTop: 4 },
  youSaid: { fontFamily: fonts.sans, fontSize: 14, fontStyle: 'italic', color: colors.textSecondary, marginBottom: 28, lineHeight: 22 },
  verseText: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.2 },
  verseRef: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent, letterSpacing: 0.5, marginTop: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 28 },
  explanationLabel: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2.5, color: colors.accent, marginBottom: 12 },
  explanation: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 27, color: colors.interactive },
  contextBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextBtnText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  lockTag: {
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  lockTagText: { fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 1, color: colors.bg },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
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
  favBtnActive: { backgroundColor: colors.textPrimary },
  shareBtn: {
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
  favBtnText: { fontFamily: fonts.sansMedium, color: colors.textPrimary, fontSize: 15 },
  newBtn: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  newBtnText: { fontFamily: fonts.sansMedium, color: colors.textSecondary, fontSize: 15 },
  toast: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  toastText: { color: colors.bg, fontFamily: fonts.sansMedium, fontSize: 13 },
  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary },
  modalScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  modalCenter: { alignItems: 'center', paddingTop: 40 },
  modalLoading: { fontFamily: fonts.sans, color: colors.textSecondary, marginTop: 16 },
  modalRef: { fontFamily: fonts.sansSemi, fontSize: 13, letterSpacing: 1.5, color: colors.accent, marginBottom: 16 },
  modalContext: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 30, color: colors.textPrimary },
});
