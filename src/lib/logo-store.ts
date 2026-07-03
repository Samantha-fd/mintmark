import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { Logo } from './types';

const STORAGE_KEY = 'logos:v1';

function logosDir(): Directory {
  const dir = new Directory(Paths.document, 'logos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function listLogos(): Promise<Logo[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Logo[]) : [];
}

export async function getLogo(id: string): Promise<Logo | undefined> {
  return (await listLogos()).find((l) => l.id === id);
}

export async function saveLogo(
  pngBytes: Uint8Array,
  meta: Pick<Logo, 'name' | 'width' | 'height'>,
  source?: { uri: string; removeBg: boolean; tolerance: number },
): Promise<Logo> {
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const file = new File(logosDir(), `${id}.png`);
  file.write(pngBytes);

  // keep a copy of the original picture so the logo can be re-edited later
  let sourceUri: string | undefined;
  if (source) {
    try {
      const ext =
        source.uri.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'img';
      const dest = new File(logosDir(), `${id}-source.${ext}`);
      new File(source.uri).copy(dest);
      sourceUri = dest.uri;
    } catch {
      // editing will fall back to the processed logo itself
    }
  }

  const logo: Logo = {
    id,
    uri: file.uri,
    createdAt: Date.now(),
    sourceUri,
    options: source ? { removeBg: source.removeBg, tolerance: source.tolerance } : undefined,
    ...meta,
  };
  const all = await listLogos();
  all.unshift(logo);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return logo;
}

/**
 * Replaces a logo's processed image and settings. Writes a new file (and
 * removes the old one) so that stale image caches keyed on the old URI can
 * never show outdated pixels.
 */
export async function updateLogo(
  id: string,
  pngBytes: Uint8Array,
  patch: Pick<Logo, 'name' | 'width' | 'height'> & { options?: Logo['options'] },
): Promise<void> {
  const all = await listLogos();
  const target = all.find((l) => l.id === id);
  if (!target) throw new Error('Logo not found.');

  const newFile = new File(logosDir(), `${id}-${Date.now()}.png`);
  newFile.write(pngBytes);
  try {
    const old = new File(target.uri);
    if (old.exists) old.delete();
  } catch {
    // old file left behind is harmless
  }

  target.uri = newFile.uri;
  target.name = patch.name;
  target.width = patch.width;
  target.height = patch.height;
  if (patch.options) target.options = patch.options;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function renameLogo(id: string, name: string): Promise<void> {
  const all = await listLogos();
  const target = all.find((l) => l.id === id);
  if (!target) return;
  target.name = name.trim() || target.name;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function deleteLogo(id: string): Promise<void> {
  const all = await listLogos();
  const target = all.find((l) => l.id === id);
  if (target) {
    for (const uri of [target.uri, target.sourceUri]) {
      if (!uri) continue;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // metadata cleanup still proceeds if the file is already gone
      }
    }
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((l) => l.id !== id)));
}
