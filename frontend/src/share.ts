import { Platform, Share as RNShare } from 'react-native';

export async function shareVerse(reference: string, verseText: string): Promise<boolean> {
  const message = `"${verseText}"\n\n— ${reference}\n\nShared from His Word`;

  if (Platform.OS === 'web') {
    const navAny = (globalThis as any).navigator;
    try {
      if (navAny && typeof navAny.share === 'function') {
        await navAny.share({ title: 'A verse for you', text: message });
        return true;
      }
      if (navAny?.clipboard?.writeText) {
        await navAny.clipboard.writeText(message);
        return true;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return false;
      // fall through
    }
    return false;
  }

  try {
    const result = await RNShare.share({ message });
    return result.action === RNShare.sharedAction;
  } catch {
    return false;
  }
}
