import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii } from '../../src/theme';

export default function Welcome() {
  const router = useRouter();
  return (
    <ImageBackground
      source={{
        uri: 'https://images.unsplash.com/photo-1776109764926-ae63208aeced?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85',
      }}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(250,249,246,0.55)', 'rgba(250,249,246,0.95)', '#FAF9F6']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Text style={styles.eyebrow} testID="welcome-eyebrow">A SANCTUARY FOR YOUR SOUL</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.title} testID="welcome-title">Verse{'\n'}for That</Text>
          <Text style={styles.subtitle}>
            Quick answers for life's{'\n'}everyday struggles.
          </Text>
        </View>
        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/signup')}
            testID="welcome-create-account-btn"
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Create free account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
            testID="welcome-login-btn"
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  top: { paddingTop: 16 },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  center: { alignItems: 'center', paddingHorizontal: 8 },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 56,
    lineHeight: 60,
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottom: { gap: 14, paddingBottom: 12 },
  primaryBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: {
    color: colors.bg,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
  },
});
