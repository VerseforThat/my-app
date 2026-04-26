import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Trash2, BookHeart, Share2 } from 'lucide-react-native';
import { api, VerseMatch } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';
import { shareVerse } from '../../src/share';

export default function Favorites() {
  const [items, setItems] = useState<VerseMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRemove = async (id: string) => {
    try {
      await api.delete(`/favorites/${id}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          <Text style={styles.title}>Saved verses</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty} testID="favorites-empty">
            <Image
              source={{ uri: 'https://images.pexels.com/photos/551611/pexels-photo-551611.jpeg?auto=compress&cs=tinysrgb&w=940' }}
              style={styles.emptyImg}
            />
            <BookHeart size={28} color={colors.accent} strokeWidth={1.4} style={{ marginTop: 24 }} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              When a verse stays with you, save it here to return to whenever you need.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card} testID={`fav-card-${item.id}`}>
              <Text style={styles.problemTag} numberOfLines={1}>
                "{item.problem}"
              </Text>
              <Text style={styles.verseText}>{item.verse_text}</Text>
              <Text style={styles.ref}>— {item.reference}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => shareVerse(item.reference, item.verse_text)}
                  testID={`fav-share-${item.id}`}
                  hitSlop={10}
                >
                  <Share2 size={16} color={colors.textSecondary} strokeWidth={1.6} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => onRemove(item.id)}
                  testID={`fav-remove-${item.id}`}
                  hitSlop={10}
                >
                  <Trash2 size={16} color={colors.textSecondary} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 20, marginBottom: 28 },
  eyebrow: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 36,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  empty: { alignItems: 'center', paddingTop: 30 },
  emptyImg: { width: 220, height: 140, borderRadius: radii.card, opacity: 0.85 },
  emptyTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  problemTag: {
    fontFamily: fonts.sans,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  verseText: {
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  ref: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    marginTop: 12,
  },
  remove: { position: 'absolute', top: 14, right: 14, padding: 6 },
  cardActions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
});
