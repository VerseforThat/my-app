import { Platform, Share as RNShare } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function shareVerse(reference: string, verseText: string): Promise<boolean> {
  const message = `"${verseText}"\n\n— ${reference}\n\nShared from Verse for That`;
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

/** Capture a styled card View ref to PNG and share it as an image. */
export async function shareVerseImage(
  cardRef: any,
  reference: string,
  verseText: string
): Promise<boolean> {
  try {
    const uri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
    });
    if (Platform.OS === 'web') {
      const navAny = (globalThis as any).navigator;
      try {
        // Try Web Share API with files
        if (navAny?.share && navAny.canShare) {
          const blob = await (await fetch(uri)).blob();
          const file = new File([blob], 'verse-for-that.png', { type: 'image/png' });
          if (navAny.canShare({ files: [file] })) {
            await navAny.share({ files: [file], title: reference, text: `"${verseText}" — ${reference}` });
            return true;
          }
        }
      } catch {}
      // Fallback: download the image
      try {
        const a = (globalThis as any).document.createElement('a');
        a.href = uri;
        a.download = `verse-${reference.replace(/[^a-z0-9]+/gi, '-')}.png`;
        a.click();
        return true;
      } catch {
        return shareVerse(reference, verseText);
      }
    }
    // Native
    const result = await RNShare.share({ url: uri, message: `"${verseText}" — ${reference}` } as any);
    return result.action === RNShare.sharedAction;
  } catch {
    return shareVerse(reference, verseText);
  }
}
