import { useEffect, useRef, useState } from 'react';
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
import {
  Heart,
  Sparkles,
  Sunrise,
  Share2,
  BookOpen,
  X,
  MessageSquareQuote,
  ListPlus,
  RefreshCcw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  api,
  formatError,
  VerseMatch,
  DailyVerse,
  VerseContext,
  DeeperExplanation,
  RelatedVerseItem,
} from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, fonts, radii } from '../../src/theme';
import VersePlayer from '../../src/VersePlayer';
import { shareVerse, shareVerseImage } from '../../src/share';

const QUICK_PROMPTS = [
  'Fear of being alone',
  'Financial stress',
  'Low self-esteem',
  'Depression',
  'Questioning everything',
];

type SheetKind = 'context' | 'explanation' | 'related' | null;

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<VerseMatch | null>(null);
  const [error, setError] = useState('');
  const [favorited, setFavorited] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [daily, setDaily] = useState<DailyVerse | null>(null);
  const [shareToast, setShareToast] = useState('');
  const shareCardRef = useRef<View | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Sheet state
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [contextData, setContextData] = useState<VerseContext | null>(null);
  const [deeperData, setDeeperData] = useState<DeeperExplanation | null>(null);
  const [relatedItems, setRelatedItems] = useState<RelatedVerseItem[]>([]);
  const [savedRelated, setSavedRelated] = useState<Set<string>>(new Set());
  const [savingRelatedRef, setSavingRelatedRef] = useState<string | null>(null);
  const [openingRelatedRef, setOpeningRelatedRef] = useState<string | null>(null);

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
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
    } catch (e: any) {
      setError(formatError(e));
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
    let ok = false;
    if (shareCardRef.current) {
      ok = await shareVerseImage(shareCardRef.current, match.reference, match.verse_text);
    } else {
      ok = await shareVerse(match.reference, match.verse_text);
    }
    if (ok && Platform.OS === 'web') {
      setShareToast('Image saved / copied');
      setTimeout(() => setShareToast(''), 1800);
    }
  };

  const openSheet = async (kind: Exclude<SheetKind, null>) => {
    if (!match) return;
    setSheet(kind);
    setSheetLoading(true);
    setSheetError('');
    setContextData(null);
    setDeeperData(null);
    setRelatedItems([]);
    try {
      if (kind === 'context') {
        const res = await api.get<VerseContext>(`/verses/${match.id}/context`);
        setContextData(res.data);
      } else if (kind === 'explanation') {
        const res = await api.get<DeeperExplanation>(`/verses/${match.id}/explanation`);
        setDeeperData(res.data);
      } else if (kind === 'related') {
        const res = await api.get<{ items: RelatedVerseItem[] }>(`/verses/${match.id}/related`);
        setRelatedItems(res.data.items || []);
        setSavedRelated(new Set());
      }
    } catch (e: any) {
      setSheetError(formatError(e));
    } finally {
      setSheetLoading(false);
    }
  };

  const closeSheet = () => {
    setSheet(null);
    setSheetError('');
  };

  const onSaveRelated = async (it: RelatedVerseItem) => {
    if (savingRelatedRef) return;
    setSavingRelatedRef(it.reference);
    try {
      await api.post('/favorites/save-verse', {
        reference: it.reference,
        verse_text: it.verse_text,
        note: it.note,
        source: 'related',
        auto_favorite: true,
      });
      setSavedRelated((prev) => new Set(prev).add(it.reference));
    } catch {} finally { setSavingRelatedRef(null); }
  };

  const onOpenRelated = async (it: RelatedVerseItem) => {
    if (openingRelatedRef) return;
    setOpeningRelatedRef(it.reference);
    try {
      const res = await api.post<{ id: string }>('/favorites/save-verse', {
        reference: it.reference,
        verse_text: it.verse_text,
        note: it.note,
        source: 'related',
        auto_favorite: false,
      });
      closeSheet();
      router.push(`/verse/${res.data.id}`);
    } catch {} finally { setOpeningRelatedRef(null); }
  };

  const onSearchAgain = () => {
    setMatch(null);
    setProblem('');
    setError('');
    setFavorited(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const sheetTitle = sheet === 'context'
    ? 'Read More of Chapter'
    : sheet === 'explanation'
      ? 'Deeper Explanation'
      : sheet === 'related'
        ? 'Other Relatable Verses'
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
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.greeting}>
                {greeting}{user?.name ? `, ${user.name}` : ''}
              </Text>
              <Text style={styles.brand} testID="home-brand">Verse for That</Text>
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
                    <View style={{ height: 14 }} />
                    <VersePlayer text={`${daily.reference}. ${daily.verse_text}. ${daily.explanation}`} />
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

                {/* 4-action grid */}
                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={styles.actionTile}
                    onPress={() => openSheet('context')}
                    testID="action-context"
                    activeOpacity={0.85}
                  >
                    <BookOpen size={20} color={colors.textPrimary} strokeWidth={1.5} />
                    <Text style={styles.actionTileText}>Read more{'\n'}of chapter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionTile}
                    onPress={() => openSheet('explanation')}
                    testID="action-explanation"
                    activeOpacity={0.85}
                  >
                    <MessageSquareQuote size={20} color={colors.textPrimary} strokeWidth={1.5} />
                    <Text style={styles.actionTileText}>Deeper{'\n'}explanation</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionTile}
                    onPress={() => openSheet('related')}
                    testID="action-related"
                    activeOpacity={0.85}
                  >
                    <ListPlus size={20} color={colors.textPrimary} strokeWidth={1.5} />
                    <Text style={styles.actionTileText}>Other relatable{'\n'}verses</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionTile}
                    onPress={onSearchAgain}
                    testID="action-search-again"
                    activeOpacity={0.85}
                  >
                    <RefreshCcw size={20} color={colors.textPrimary} strokeWidth={1.5} />
                    <Text style={styles.actionTileText}>Search{'\n'}again</Text>
                  </TouchableOpacity>
                </View>

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
                      color={favorited ? colors.interactiveText : colors.textPrimary}
                      strokeWidth={1.8}
                      fill={favorited ? colors.interactiveText : 'transparent'}
                    />
                    <Text style={[styles.favBtnText, favorited && { color: colors.interactiveText }]}>
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

                {!!shareToast && (
                  <View style={styles.toast} testID="share-toast">
                    <Text style={styles.toastText}>{shareToast}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Hidden, off-screen styled card used for image-share capture */}
            {match && (
              <View collapsable={false} ref={shareCardRef as any} style={styles.shareCard}>
                <Text style={styles.shareCardEyebrow}>VERSE FOR THAT</Text>
                <Text style={styles.shareCardVerse}>"{match.verse_text}"</Text>
                <Text style={styles.shareCardRef}>— {match.reference}</Text>
                <View style={styles.shareCardLine} />
                <Text style={styles.shareCardFooter}>verseforthat</Text>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Reusable sheet for context / explanation / related */}
      <Modal
        visible={sheet !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{sheetTitle}</Text>
            <TouchableOpacity onPress={closeSheet} hitSlop={10} testID="sheet-close-btn">
              <X size={26} color={colors.textPrimary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {sheetLoading && (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.modalLoading}>One moment…</Text>
              </View>
            )}
            {!!sheetError && <Text style={styles.error} testID="sheet-error">{sheetError}</Text>}

            {sheet === 'context' && contextData && (
              <>
                <Text style={styles.modalRef}>{contextData.reference}</Text>
                <Text style={styles.modalContext}>{contextData.context_text}</Text>
                <View style={{ height: 24 }} />
                <VersePlayer text={contextData.context_text} />
              </>
            )}

            {sheet === 'explanation' && deeperData && (
              <>
                <Text style={styles.modalRef}>{deeperData.reference}</Text>
                <Text style={styles.modalReflection}>{deeperData.explanation}</Text>
                <View style={{ height: 24 }} />
                <VersePlayer text={deeperData.explanation} />
              </>
            )}

            {sheet === 'related' && relatedItems.length > 0 && (
              <>
                {relatedItems.map((it, idx) => {
                  const saved = savedRelated.has(it.reference);
                  const opening = openingRelatedRef === it.reference;
                  const savingNow = savingRelatedRef === it.reference;
                  return (
                    <TouchableOpacity
                      key={`${it.reference}-${idx}`}
                      style={styles.relatedCard}
                      onPress={() => onOpenRelated(it)}
                      disabled={opening}
                      activeOpacity={0.85}
                      testID={`related-card-${idx}`}
                    >
                      <View style={styles.relatedHeader}>
                        <Text style={styles.relatedRef}>{it.reference}</Text>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); onSaveRelated(it); }}
                          disabled={saved || savingNow}
                          hitSlop={10}
                          testID={`related-save-${idx}`}
                        >
                          {savingNow ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <Heart
                              size={20}
                              color={saved ? colors.interactive : colors.textSecondary}
                              fill={saved ? colors.interactive : 'transparent'}
                              strokeWidth={1.6}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.relatedVerse}>{it.verse_text}</Text>
                      <Text style={styles.relatedNote}>{it.note}</Text>
                      <View style={{ height: 12 }} />
                      <VersePlayer text={`${it.reference}. ${it.verse_text}`} />
                      {opening && (
                        <View style={styles.openingOverlay}>
                          <ActivityIndicator color={colors.accent} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
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
  brand: { fontFamily: fonts.serifBold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5, marginTop: 2 },
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
  promptHelp: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 22, marginBottom: 14 },
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
    backgroundColor: colors.interactive,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitBtnText: { color: colors.interactiveText, fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: 0.3 },
  resultSection: { paddingTop: 4 },
  youSaid: { fontFamily: fonts.sans, fontSize: 14, fontStyle: 'italic', color: colors.textSecondary, marginBottom: 28, lineHeight: 22 },
  verseText: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.2 },
  verseRef: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent, letterSpacing: 0.5, marginTop: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 28 },
  explanationLabel: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2.5, color: colors.accent, marginBottom: 12 },
  explanation: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 27, color: colors.textAccent },
  actionGrid: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
  },
  actionTileText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    flexShrink: 1,
  },
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
    borderColor: colors.interactive,
  },
  favBtnActive: { backgroundColor: colors.interactive },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.interactive,
  },
  favBtnText: { fontFamily: fonts.sansMedium, color: colors.textPrimary, fontSize: 15 },
  toast: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  toastText: { color: colors.textOnDark, fontFamily: fonts.sansMedium, fontSize: 13 },
  // Hidden share card (off-screen) — captured to PNG when sharing
  shareCard: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 1080,
    backgroundColor: colors.bg,
    paddingHorizontal: 80,
    paddingVertical: 100,
    alignItems: 'center',
  },
  shareCardEyebrow: { fontFamily: fonts.sansSemi, fontSize: 22, letterSpacing: 6, color: colors.accent },
  shareCardVerse: { fontFamily: fonts.serif, fontSize: 64, lineHeight: 90, color: colors.textPrimary, textAlign: 'center', marginTop: 60 },
  shareCardRef: { fontFamily: fonts.sansMedium, fontSize: 28, color: colors.accent, marginTop: 60, letterSpacing: 1 },
  shareCardLine: { width: 80, height: 2, backgroundColor: colors.interactive, marginTop: 80 },
  shareCardFooter: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.textPrimary, marginTop: 30, letterSpacing: 4 },
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
  modalReflection: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 27, color: colors.textAccent },
  relatedCard: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  relatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  openingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  relatedRef: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1.5, color: colors.accent },
  relatedVerse: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.textPrimary },
  relatedNote: { fontFamily: fonts.sans, fontSize: 14, fontStyle: 'italic', color: colors.textSecondary, marginTop: 8, lineHeight: 20 },
});
