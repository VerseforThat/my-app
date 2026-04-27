import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, Heart } from 'lucide-react-native';
import { api, formatError, VerseSearchItem } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import VersePlayer from '../../src/VersePlayer';

const SUGGESTIONS = ['John 3:16', 'Psalm 23', 'Romans 8:28', 'love', 'anxiety', 'forgiveness'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<VerseSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [savedRefs, setSavedRefs] = useState<Set<string>>(new Set());
  const [savingRef, setSavingRef] = useState<string | null>(null);

  const runSearch = async (text: string) => {
    Keyboard.dismiss();
    const q = text.trim();
    if (!q) { setError('Type a verse reference or a topic.'); return; }
    setError(''); setLoading(true); setItems([]);
    try {
      const res = await api.post<{ query: string; items: VerseSearchItem[] }>('/verses/search', { query: q });
      setItems(res.data.items || []);
      setHasSearched(true);
    } catch (e: any) {
      setError(formatError(e));
    } finally { setLoading(false); }
  };

  const onSuggestion = (s: string) => { setQuery(s); runSearch(s); };

  const onSave = async (it: VerseSearchItem) => {
    if (savingRef) return;
    setSavingRef(it.reference);
    try {
      await api.post('/favorites/save-verse', {
        reference: it.reference,
        verse_text: it.verse_text,
        note: it.note,
        source: 'search',
      });
      setSavedRefs((prev) => new Set(prev).add(it.reference));
    } catch {} finally { setSavingRef(null); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>BIBLE SEARCH</Text>
              <Text style={styles.title}>Look up a verse</Text>
              <Text style={styles.subtitle}>
                Type a reference like <Text style={styles.subtitleStrong}>"John 3:16"</Text> or a topic like <Text style={styles.subtitleStrong}>"patience"</Text>.
              </Text>
            </View>

            <View style={styles.searchRow}>
              <SearchIcon size={18} color={colors.textSecondary} strokeWidth={1.6} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="John 3:16, love, hope…"
                placeholderTextColor={colors.textDisabled}
                onSubmitEditing={() => runSearch(query)}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                testID="search-input"
              />
            </View>

            <TouchableOpacity
              style={[styles.searchBtn, loading && { opacity: 0.6 }]}
              onPress={() => runSearch(query)}
              disabled={loading}
              testID="search-submit-btn"
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={colors.interactiveText} /> : <Text style={styles.searchBtnText}>Search</Text>}
            </TouchableOpacity>

            {!!error && <Text style={styles.error} testID="search-error">{error}</Text>}

            {!hasSearched && !loading && (
              <View style={styles.suggestWrap}>
                <Text style={styles.suggestLabel}>TRY</Text>
                <View style={styles.chips}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity key={s} style={styles.chip} onPress={() => onSuggestion(s)} activeOpacity={0.75}>
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {items.length > 0 && (
              <View style={styles.resultsWrap} testID="search-results">
                {items.map((it, idx) => {
                  const saved = savedRefs.has(it.reference);
                  return (
                    <View key={`${it.reference}-${idx}`} style={styles.resultCard}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultRef}>{it.reference}</Text>
                        <TouchableOpacity
                          onPress={() => onSave(it)}
                          disabled={saved || savingRef === it.reference}
                          hitSlop={10}
                          testID={`search-save-${idx}`}
                        >
                          {savingRef === it.reference ? (
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
                      <Text style={styles.resultVerse}>{it.verse_text}</Text>
                      {!!it.note && <Text style={styles.resultNote}>{it.note}</Text>}
                      <View style={{ height: 12 }} />
                      <VersePlayer text={`${it.reference}. ${it.verse_text}`} />
                    </View>
                  );
                })}
              </View>
            )}

            {hasSearched && !loading && items.length === 0 && !error && (
              <Text style={styles.empty}>No verses found. Try a different word or reference.</Text>
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
  header: { paddingTop: 20, marginBottom: 24 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 2.5, color: colors.textSecondary },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.textPrimary, letterSpacing: -0.5, marginTop: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 10 },
  subtitleStrong: { fontFamily: fonts.sansSemi, color: colors.textPrimary },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radii.input,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 4, marginBottom: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 0 : 12 },
  searchBtn: { backgroundColor: colors.interactive, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: colors.interactiveText, fontFamily: fonts.sansMedium, fontSize: 15, letterSpacing: 0.3 },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 14, marginTop: 12 },
  suggestWrap: { marginTop: 28 },
  suggestLabel: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 2, color: colors.textSecondary, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
  resultsWrap: { marginTop: 20 },
  resultCard: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 12 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultRef: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1.5, color: colors.accent },
  resultVerse: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 30, color: colors.textPrimary },
  resultNote: { fontFamily: fonts.sans, fontSize: 13, fontStyle: 'italic', color: colors.textSecondary, marginTop: 10, lineHeight: 20 },
  empty: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
});
