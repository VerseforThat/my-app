// VoiceInputButton — accessible microphone button that records with expo-av,
// uploads to /api/tts/transcribe, and returns the transcribed text via
// `onTranscribed`. Designed to be tappable for users who can't or prefer not
// to type. Press once to start recording, press again to stop & transcribe.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Mic, MicOff, Square } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { api, formatError } from './api';
import { colors, fonts, radii } from './theme';
import { useAccessibility } from './AccessibilityContext';

type Props = {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(1, '0');
  const r = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
};

export default function VoiceInputButton({ onTranscribed, disabled }: Props) {
  const { reducedMotion } = useAccessibility();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<any>(null);
  const pulse = useSharedValue(1);

  const isRecording = !!recording;

  useEffect(() => {
    if (isRecording && !reducedMotion) {
      pulse.value = withRepeat(withTiming(1.18, { duration: 800 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1);
    }
  }, [isRecording, reducedMotion, pulse]);

  useEffect(() => {
    return () => {
      try { if (tickRef.current) clearInterval(tickRef.current); } catch {}
      // safety unload
      recording?.stopAndUnloadAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError('');
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone permission needed',
          'Please enable microphone access in Settings to dictate your problem.'
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await rec.startAsync();
      setRecording(rec);
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } catch (e) {
      setError(formatError(e));
    }
  };

  const stopAndTranscribe = async () => {
    if (!recording) return;
    try { if (tickRef.current) clearInterval(tickRef.current); } catch {}
    setBusy(true);
    setError('');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('Recording failed');
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await api.post(
        '/tts/transcribe',
        { audio_base64: b64, language_code: 'en' },
        { timeout: 60000 },
      );
      const text: string = (res.data?.text ?? '').trim();
      if (!text) {
        setError("I couldn't catch that. Please try again.");
      } else {
        onTranscribed(text);
      }
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
      // Restore audio mode for verse playback
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {}
    }
  };

  const onPress = () => {
    if (busy) return;
    if (isRecording) {
      stopAndTranscribe();
    } else {
      start();
    }
  };

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const label = busy
    ? 'Transcribing your voice'
    : isRecording
    ? `Stop recording. ${fmt(elapsed)} elapsed. Tap to transcribe and fill your problem.`
    : 'Speak your struggle instead of typing. Tap to start recording.';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.btn,
            isRecording && styles.btnRecording,
            (disabled || busy) && { opacity: 0.7 },
          ]}
          onPress={onPress}
          disabled={!!disabled || busy}
          testID="voice-input-btn"
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Records audio of your problem and transcribes it into the input"
          accessibilityState={{ busy: busy, selected: isRecording }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {Platform.OS !== 'web' && isRecording && !reducedMotion && (
            <Animated.View style={[styles.ring, ringStyle]} />
          )}
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : isRecording ? (
            <Square size={16} color={colors.bg} strokeWidth={2} fill={colors.bg} />
          ) : (
            <Mic size={16} color={colors.bg} strokeWidth={1.8} />
          )}
          <Text style={styles.btnText}>
            {busy
              ? 'Transcribing…'
              : isRecording
              ? `Stop · ${fmt(elapsed)}`
              : 'Speak instead'}
          </Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'visible',
  },
  btnRecording: { backgroundColor: '#9B3535' },
  btnText: {
    fontFamily: fonts.sansMedium,
    color: colors.bg,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  ring: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: '#9B3535',
  },
  error: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#9B3535',
  },
});
