import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { api, formatError } from './api';
import { colors, fonts } from './theme';

type Props = { text: string };

export default function VersePlayer({ text }: Props) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<any>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when verse text changes
  useEffect(() => {
    cleanup();
    setPlaying(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (playing) {
      pulse.value = withRepeat(withTiming(1.18, { duration: 900 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1);
    }
  }, [playing, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.4 - pulse.value,
  }));

  const cleanup = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    if (webAudioRef.current) {
      try {
        webAudioRef.current.pause();
      } catch {}
      webAudioRef.current = null;
    }
  };

  const playWeb = (b64: string) => {
    const audio = new (globalThis as any).Audio(`data:audio/mpeg;base64,${b64}`);
    webAudioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      setPlaying(false);
      setError('Could not play audio');
    };
    audio.play();
    setPlaying(true);
  };

  const playNative = async (b64: string) => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/mpeg;base64,${b64}` },
      { shouldPlay: true },
    );
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        setPlaying(false);
      }
    });
    setPlaying(true);
  };

  const onToggle = async () => {
    setError('');
    if (playing) {
      // pause
      if (Platform.OS === 'web' && webAudioRef.current) {
        webAudioRef.current.pause();
      } else if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
      setPlaying(false);
      return;
    }

    // resume?
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.play();
      setPlaying(true);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setPlaying(true);
      return;
    }

    // First play -> fetch audio
    setLoading(true);
    try {
      const res = await api.post('/tts/generate', { text });
      const b64 = res.data.audio_base64;
      if (Platform.OS === 'web') {
        playWeb(b64);
      } else {
        await playNative(b64);
      }
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.btnWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, ringStyle]}
          />
          <TouchableOpacity
            style={styles.btn}
            onPress={onToggle}
            disabled={loading}
            testID="verse-play-pause-btn"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : playing ? (
              <Pause size={22} color={colors.bg} strokeWidth={1.8} fill={colors.bg} />
            ) : (
              <Play size={22} color={colors.bg} strokeWidth={1.8} fill={colors.bg} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{playing ? 'Listening' : loading ? 'Preparing voice…' : 'Listen to this verse'}</Text>
          <Text style={styles.sub}>Spoken aloud, as a gentle whisper</Text>
        </View>
      </View>
      {error ? <Text style={styles.error} testID="verse-player-error">{error}</Text> : null}
    </View>
  );
}

const SIZE = 60;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  btnWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: { flex: 1 },
  label: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.textPrimary },
  sub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  error: { color: colors.error, fontSize: 13, fontFamily: fonts.sans, marginTop: 10 },
});
