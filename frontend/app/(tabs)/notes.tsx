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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BotanicalBackground from '../../src/BotanicalBackground';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, NotebookPen } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { api, formatError, Note } from '../../src/api';
import { colors, fonts, radii } from '../../src/theme';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = (r.result as string) || '';
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return blobToBase64(blob);
}

export default function Notes() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingNow, setRecordingNow] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Note[]>('/notes');
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecordingNow(true);
    } catch (e: any) {
      setError('Could not start recording. ' + (e?.message || ''));
    }
  };

  const stopRecordingAndSave = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingNow(false);
      setRecording(null);
      if (!uri) return;
      setSaving(true);
      const audio_base64 = await uriToBase64(uri);
      await api.post<Note>('/notes', {
        text: text.trim() || '',
        audio_base64,
        title: text.trim() ? text.trim().slice(0, 60) : 'Voice memo',
      });
      setText('');
      await load();
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
    setRecordingNow(false);
  };

  const saveTextOnly = async () => {
    if (!text.trim()) {
      setError('Type something or record a memo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post<Note>('/notes', { text: text.trim(), title: text.trim().slice(0, 60) });
      setText('');
      await load();
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  };

  const playNote = async (note: Note) => {
    if (!note.audio_base64) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (playingId === note.id) {
        setPlayingId(null);
        return;
      }
      // Write base64 to a temp file — large data: URIs fail on iOS native via expo-av
      let uri: string;
      if (Platform.OS === 'web') {
        uri = `data:audio/m4a;base64,${note.audio_base64}`;
      } else {
        const path = `${FileSystem.cacheDirectory}note-${note.id}.m4a`;
        await FileSystem.writeAsStringAsync(path, note.audio_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uri = path;
      }
      // Make sure iOS plays in silent mode and through the speaker, not the earpiece
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch {}
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(note.id);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.warn('playNote failed', e);
      setPlayingId(null);
    }
  };

  const removeNote = async (id: string) => {
    const doDelete = async () => {
      try {
        await api.delete(`/notes/${id}`);
        setItems((p) => p.filter((n) => n.id !== id));
      } catch {}
    };
    if (Platform.OS === 'web') doDelete();
    else Alert.alert('Delete note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BotanicalBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.eyebrow}>YOUR THOUGHTS</Text>
              <Text style={styles.title}>Notes</Text>
              <Text style={styles.subtitle}>
                Write a thought, or hold to record a voice memo.
              </Text>
            </View>

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="What's on your heart..."
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
                testID="note-text-input"
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.composerActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || (!text.trim() && !recordingNow)) && { opacity: 0.55 }]}
                  onPress={saveTextOnly}
                  disabled={saving || (!text.trim() && !recordingNow)}
                  testID="note-save-btn"
                >
                  {saving ? (
                    <ActivityIndicator color={colors.interactiveText} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>

                {Platform.OS !== 'web' && (
                  recordingNow ? (
                    <View style={styles.micGroup}>
                      <TouchableOpacity style={styles.micCancel} onPress={cancelRecording}>
                        <MicOff size={18} color={colors.error} strokeWidth={1.6} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.micStop} onPress={stopRecordingAndSave} testID="note-mic-stop">
                        <View style={styles.micPulseDot} />
                        <Text style={styles.micStopText}>Stop & save</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.micBtn} onPress={startRecording} testID="note-mic-start">
                      <Mic size={20} color={colors.interactiveText} strokeWidth={1.6} />
                    </TouchableOpacity>
                  )
                )}
              </View>

              {Platform.OS === 'web' && (
                <Text style={styles.webHint}>Voice memos are recorded on the mobile app.</Text>
              )}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : items.length === 0 ? (
              <View style={styles.empty}>
                <NotebookPen size={28} color={colors.accent} strokeWidth={1.4} />
                <Text style={styles.emptyTitle}>No notes yet</Text>
                <Text style={styles.emptyText}>Capture a thought or record a memo — it lives here for you.</Text>
              </View>
            ) : (
              items.map((n) => (
                <View key={n.id} style={styles.card} testID={`note-card-${n.id}`}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardDate}>{formatDate(n.created_at)}</Text>
                    <TouchableOpacity onPress={() => removeNote(n.id)} hitSlop={10}>
                      <Trash2 size={15} color={colors.textSecondary} strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>
                  {!!n.text && <Text style={styles.cardText}>{n.text}</Text>}
                  {!!n.audio_base64 && (
                    <TouchableOpacity
                      style={styles.audioPill}
                      onPress={() => playNote(n)}
                      testID={`note-play-${n.id}`}
                    >
                      {playingId === n.id ? (
                        <Pause size={14} color={colors.interactiveText} strokeWidth={1.8} fill={colors.interactiveText} />
                      ) : (
                        <Play size={14} color={colors.interactiveText} strokeWidth={1.8} fill={colors.interactiveText} />
                      )}
                      <Text style={styles.audioPillText}>{playingId === n.id ? 'Playing…' : 'Play voice memo'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
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
  header: { paddingTop: 20, marginBottom: 18 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 2.5, color: colors.textSecondary },
  title: { fontFamily: fonts.serifBold, fontSize: 36, color: colors.textPrimary, letterSpacing: -0.5, marginTop: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 22 },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginTop: 12,
  },
  input: {
    minHeight: 96, fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.textPrimary,
  },
  error: { color: colors.error, fontFamily: fonts.sans, fontSize: 13, marginTop: 8 },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  saveBtn: {
    flex: 1, backgroundColor: colors.interactive, borderRadius: radii.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.interactiveText, letterSpacing: 0.3 },
  micBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.interactive,
    alignItems: 'center', justifyContent: 'center',
  },
  micGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  micCancel: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  micStop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 44, borderRadius: 22, backgroundColor: colors.error,
  },
  micPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  micStopText: { fontFamily: fonts.sansMedium, color: '#fff', fontSize: 13 },
  webHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.textPrimary, marginTop: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 22, paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginTop: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1.5, color: colors.textSecondary },
  cardText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.textPrimary, marginTop: 10 },
  audioPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.interactive, marginTop: 12,
  },
  audioPillText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.interactiveText },
});
