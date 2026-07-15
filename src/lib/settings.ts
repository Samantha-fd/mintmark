import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'settings:v1';

export type Settings = {
  /** also save every stamped photo to the phone's gallery (the Markly album) */
  phoneGalleryBackup: boolean;
};

const DEFAULTS: Settings = {
  phoneGalleryBackup: true,
};

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [key]: value }));
}
