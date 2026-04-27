import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BotanicalBackground from '../../src/BotanicalBackground';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2, BookHeart, Play, Pause, Share2 } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { api, VerseMatch } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import { shareVerse } from '../../src/share';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Favorites() {
  const router = useRouter();
  const [items, setItems] = useState<VerseMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<VerseMatch[]>('/favorites');
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const onRemove = async (id: string) => {
    try {
      await api.delete(`/favorites/${id}`);
      setItems((p) => p.filter((x) => x.id !== id));
    } catch {}
  };

  const onPlay = async (item: VerseMatch) => {
    if (loadingId) return;
    if (playingId === item.id) {
      try { await soundRef.current?.unloadAsync(); } catch {}
      soundRef.current = null;
      setPlayingId(null);
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      setLoadingId(item.id);
      const res = await api.post<{ audio_base64: string; mime_type: string }>('/tts/generate', {
        text: `${item.reference}. ${item.verse_text}`,
      });
      setLoadingId(null);
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${res.data.mime_type};base64,${res.data.audio_base64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingId(item.id);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      setLoadingId(null);
      setPlayingId(null);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BotanicalBackground />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          <Text style={styles.title}>Saved verses</Text>
          <Text style={styles.subtitle}>Tap to open. Tap the gold button to listen.</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty} testID="favorites-empty">
            <BookHeart size={28} color={colors.accent} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>When a verse stays with you, save it here to return to whenever you need.</Text>
          </View>
        ) : items.map((item) => {
          const isPlaying = playingId === item.id;
          const isLoading = loadingId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => router.push(`/verse/${item.id}`)}
              testID={`fav-card-${item.id}`}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.savedRef}>{item.reference}</Text>
                <Text style={styles.savedDate}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={styles.savedVerse} numberOfLines={3}>{item.verse_text}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.playPill, isPlaying && styles.playPillActive]}
                  onPress={(e) => { e.stopPropagation?.(); onPlay(item); }}
                  testID={`fav-play-${item.id}`}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.interactiveText} />
                  ) : isPlaying ? (
                    <Pause size={14} color={colors.interactiveText} fill={colors.interactiveText} strokeWidth={1.8} />
                  ) : (
                    <Play size={14} color={colors.interactiveText} fill={colors.interactiveText} strokeWidth={1.8} />
                  )}
                  <Text style={styles.playPillText}>{isLoading ? 'Loading…' : isPlaying ? 'Playing' : 'Listen'}</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={(e) => { e.stopPropagation?.(); shareVerse(item.reference, item.verse_text); }}
                  hitSlop={10}
                >
                  <Share2 size={16} color={colors.textSecondary} strokeWidth={1.6} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={(e) => { e.stopPropagation?.(); onRemove(item.id); }}
                  hitSlop={10}
                  testID={`fav-remove-${item.id}`}
                >
                  <Trash2 size={16} color={colors.textSecondary} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 20, marginBottom: 24 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 2.5, color: colors.textSecondary },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.textPrimary, letterSpacing: -0.5, marginTop: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 22 },
  empty: { alignItems: 'center', paddingTop: 30 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, marginTop: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  savedRef: { fontFamily: fonts.sansSemi, fontSize: 13, letterSpacing: 1.5, color: colors.accent, textTransform: 'uppercase' },
  savedDate: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5 },
  savedVerse: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 28, color: colors.textPrimary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  playPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.interactive },
  playPillActive: { backgroundColor: colors.interactiveHover },
  playPillText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.interactiveText },
  iconBtn: { padding: 8 },
});
