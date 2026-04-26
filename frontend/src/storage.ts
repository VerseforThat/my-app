import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

const memoryStore: Record<string, string> = {};

const webStorage = {
  get: (key: string): string | null => {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage.getItem(key);
      }
    } catch {}
    return memoryStore[key] ?? null;
  },
  set: (key: string, value: string) => {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore[key] = value;
  },
  del: (key: string) => {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.removeItem(key);
        return;
      }
    } catch {}
    delete memoryStore[key];
  },
};

async function nativeStore() {
  // Lazy import so web bundle doesn't try to evaluate native bindings.
  return await import('expo-secure-store');
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return webStorage.get(key);
  const SecureStore = await nativeStore();
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) return webStorage.set(key, value);
  const SecureStore = await nativeStore();
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) return webStorage.del(key);
  const SecureStore = await nativeStore();
  return SecureStore.deleteItemAsync(key);
}
