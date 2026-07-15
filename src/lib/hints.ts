import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hints:v1';

type Hints = Record<string, number>;

async function readAll(): Promise<Hints> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Hints) : {};
}

/** How many times a one-time hint has been shown so far. */
export async function timesSeen(key: string): Promise<number> {
  return (await readAll())[key] ?? 0;
}

export async function markSeen(key: string): Promise<void> {
  const all = await readAll();
  all[key] = (all[key] ?? 0) + 1;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
