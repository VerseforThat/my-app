import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock, Heart, ChevronRight } from 'lucide-react-native';
import { api, VerseMatch } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function History() {
  const router = useRouter();
  const [items, setItems] = useState<VerseMatch[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [hist, favs] = await Promise.all([
        api.get<VerseMatch[]>('/history'),
        api.get<VerseMatch[]>('/favorites'),
      ]);
      setItems(hist.data);
      setFavIds(new Set(favs.data.map((f) => f.id)));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFav = async (id: string) => {
    const isFav = favIds.has(id);
    const next = new Set(favIds);
    try {
      if (isFav) {
        await api.delete(`/favorites/${id}`);
        next.delete(id);
      } else {
        await api.post('/favorites', { match_id: id });
        next.add(id);
      }
      setFavIds(next);
    } catch {}
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR JOURNEY</Text>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Tap any verse to re-open. Save the ones that stay with you.</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty} testID="history-empty">
            <Image source={{ uri: 'https://images.pexels.com/photos/551611/pexels-photo-551611.jpeg?auto=compress&cs=tinysrgb&w=940' }} style={styles.emptyImg} />
            <Clock size={28} color={colors.accent} strokeWidth={1.4} style={{ marginTop: 24 }} />
            <Text style={styles.emptyTitle}>Your story begins today</Text>
            <Text style={styles.emptyText}>Every time you ask, Verse for That remembers. Bring your first concern from the Home tab.</Text>
          </View>
        ) : items.map((item) => {
          const isFav = favIds.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => router.push(`/verse/${item.id}`)}
              testID={`history-card-${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); toggleFav(item.id); }}
                    hitSlop={10}
                    testID={`history-fav-${item.id}`}
                  >
                    <Heart size={18} color={isFav ? colors.interactive : colors.textSecondary} fill={isFav ? colors.interactive : 'transparent'} strokeWidth={1.6} />
                  </TouchableOpacity>
                  <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.6} />
                </View>
              </View>
              <Text style={styles.problem} numberOfLines={2}>"{item.problem}"</Text>
              <View style={styles.verseRow}>
                <Text style={styles.verseText} numberOfLines={3}>{item.verse_text}</Text>
                <Text style={styles.ref}>— {item.reference}</Text>
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
  empty: { alignItems: 'center', paddingTop: 24 },
  emptyImg: { width: 220, height: 140, borderRadius: radii.card, opacity: 0.85 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.textPrimary, marginTop: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.5, color: colors.textSecondary, textTransform: 'uppercase' },
  problem: { fontFamily: fonts.sans, fontStyle: 'italic', fontSize: 14, color: colors.textPrimary, marginTop: 10, lineHeight: 22 },
  verseRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  verseText: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  ref: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent, marginTop: 8 },
});
