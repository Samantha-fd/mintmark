import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { StampedPhoto } from './types';

const STORAGE_KEY = 'stamped:v1';

function stampedDir(): Directory {
  const dir = new Directory(Paths.document, 'stamped');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function listStamped(): Promise<StampedPhoto[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StampedPhoto[]) : [];
}

export async function getStamped(id: string): Promise<StampedPhoto | undefined> {
  return (await listStamped()).find((s) => s.id === id);
}

/**
 * Copies the original (un-stamped) photo into app storage. The picker's URI
 * points at a cache file Android may purge at any time — without our own
 * copy, "Remove logo" would eventually stop working.
 */
function importOriginal(uri: string, id: string): string | undefined {
  try {
    const ext =
      uri.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'img';
    const dest = new File(stampedDir(), `${id}-original.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return undefined; // editing falls back gracefully when no original exists
  }
}

export async function saveStamped(
  jpegBytes: Uint8Array,
  meta: Pick<StampedPhoto, 'width' | 'height'> & { photoUri?: string },
): Promise<StampedPhoto> {
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const file = new File(stampedDir(), `${id}.jpg`);
  file.write(jpegBytes);

  const photo: StampedPhoto = {
    id,
    uri: file.uri,
    createdAt: Date.now(),
    width: meta.width,
    height: meta.height,
    photoUri: meta.photoUri ? importOriginal(meta.photoUri, id) : undefined,
  };
  const all = await listStamped();
  all.unshift(photo);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return photo;
}

/**
 * Replaces the composite image. Writes a NEW file and deletes the old one so
 * image caches keyed on the old URI can never show stale pixels. The stored
 * original (`photoUri`) is never touched — "remove logo" always restores the
 * true original photo, no matter how many edits happened in between.
 */
export async function updateStamped(
  id: string,
  jpegBytes: Uint8Array,
  meta: Pick<StampedPhoto, 'width' | 'height'>,
): Promise<StampedPhoto> {
  const all = await listStamped();
  const target = all.find((s) => s.id === id);
  if (!target) throw new Error('Stamped photo not found');

  const newFile = new File(stampedDir(), `${id}-${Date.now()}.jpg`);
  newFile.write(jpegBytes);
  if (target.uri !== target.photoUri) {
    try {
      const old = new File(target.uri);
      if (old.exists) old.delete();
    } catch {
      // a leftover file is harmless
    }
  }

  target.uri = newFile.uri;
  target.width = meta.width;
  target.height = meta.height;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return target;
}

export async function deleteStamped(id: string): Promise<void> {
  const all = await listStamped();
  const target = all.find((s) => s.id === id);
  if (target) {
    for (const uri of [target.uri, target.photoUri]) {
      if (!uri) continue;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // metadata cleanup still proceeds if the file is already gone
      }
    }
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((s) => s.id !== id)));
}
