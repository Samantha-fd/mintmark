import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { StampedPhoto } from './types';

const STORAGE_KEY = 'stamped:v1';

/** How long deleted photos stay in "Recently deleted" before being purged. */
export const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Change notifications, so list screens can refresh after background
 * mutations (e.g. an Undo pressed from a toast after navigating away).
 */
const listeners = new Set<() => void>();

export function onStampedChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function persist(all: StampedPhoto[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  listeners.forEach((l) => l());
}

function stampedDir(): Directory {
  const dir = new Directory(Paths.document, 'stamped');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function deleteFile(uri: string | undefined) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // a leftover file is harmless
  }
}

function deleteFilesOf(photo: StampedPhoto) {
  deleteFile(photo.uri);
  deleteFile(photo.photoUri);
  deleteFile(photo.thumbUri);
}

/**
 * Full list (active + trashed), purging anything whose trash retention has
 * expired. All mutations below go through this so expired entries and their
 * files disappear on their own.
 */
async function readAll(): Promise<StampedPhoto[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const all = raw ? (JSON.parse(raw) as StampedPhoto[]) : [];
  const now = Date.now();
  const expired = all.filter((p) => p.deletedAt && now - p.deletedAt > TRASH_RETENTION_MS);
  if (expired.length === 0) return all;
  for (const photo of expired) deleteFilesOf(photo);
  const kept = all.filter((p) => !expired.includes(p));
  await persist(kept);
  return kept;
}

export async function listStamped(): Promise<StampedPhoto[]> {
  return (await readAll()).filter((p) => !p.deletedAt);
}

/** Photos in "Recently deleted", newest deletion first. */
export async function listDeleted(): Promise<StampedPhoto[]> {
  return (await readAll())
    .filter((p) => p.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function getStamped(id: string): Promise<StampedPhoto | undefined> {
  return (await readAll()).find((s) => s.id === id);
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
  const all = await readAll();
  all.unshift(photo);
  await persist(all);
  return photo;
}

/**
 * Moves a stamped mp4 (and its watermarked poster frame) from the cache into
 * the library.
 */
export async function saveStampedVideo(
  videoCacheUri: string,
  meta: { width: number; height: number; thumbUri?: string },
): Promise<StampedPhoto> {
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const file = new File(stampedDir(), `${id}.mp4`);
  new File(videoCacheUri).move(file);

  let storedThumb: string | undefined;
  if (meta.thumbUri) {
    try {
      const thumb = new File(stampedDir(), `${id}-thumb.jpg`);
      new File(meta.thumbUri).move(thumb);
      storedThumb = thumb.uri;
    } catch {
      // grid falls back to a placeholder without a thumb
    }
  }

  const video: StampedPhoto = {
    id,
    uri: file.uri,
    createdAt: Date.now(),
    width: meta.width,
    height: meta.height,
    mediaType: 'video',
    thumbUri: storedThumb,
  };
  const all = await readAll();
  all.unshift(video);
  await persist(all);
  return video;
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
  const all = await readAll();
  const target = all.find((s) => s.id === id);
  if (!target) throw new Error('Stamped photo not found');

  const newFile = new File(stampedDir(), `${id}-${Date.now()}.jpg`);
  newFile.write(jpegBytes);
  if (target.uri !== target.photoUri) deleteFile(target.uri);

  target.uri = newFile.uri;
  target.width = meta.width;
  target.height = meta.height;
  await persist(all);
  return target;
}

/**
 * Moves stamped photos to "Recently deleted". Files stay on disk; the photos
 * are restorable (via the returned closure or the Recently deleted screen)
 * until the retention window expires.
 */
export async function removeStamped(ids: string[]): Promise<() => Promise<void>> {
  const all = await readAll();
  const now = Date.now();
  for (const photo of all) {
    if (ids.includes(photo.id)) photo.deletedAt = now;
  }
  await persist(all);
  return () => restoreStamped(ids);
}

/** Brings photos back from "Recently deleted". */
export async function restoreStamped(ids: string[]): Promise<void> {
  const all = await readAll();
  for (const photo of all) {
    if (ids.includes(photo.id)) delete photo.deletedAt;
  }
  await persist(all);
}

/** Permanently deletes photos (files included). No way back from this one. */
export async function purgeStamped(ids: string[]): Promise<void> {
  const all = await readAll();
  for (const photo of all) {
    if (ids.includes(photo.id)) deleteFilesOf(photo);
  }
  await persist(all.filter((p) => !ids.includes(p.id)));
}

/**
 * How long the replaced composite stays undoable. Generous because the undo
 * is also reachable from the photo's "More" menu, not just the toast.
 */
const UNDO_WINDOW_MS = 5 * 60 * 1000;

/**
 * Like `updateStamped`, but keeps the replaced composite on disk for a short
 * undo window. The returned `undo` puts the previous image back.
 */
export async function updateStampedWithUndo(
  id: string,
  jpegBytes: Uint8Array,
  meta: Pick<StampedPhoto, 'width' | 'height'>,
): Promise<{ photo: StampedPhoto; undo: () => Promise<void> }> {
  const all = await readAll();
  const target = all.find((s) => s.id === id);
  if (!target) throw new Error('Stamped photo not found');

  const old = { uri: target.uri, width: target.width, height: target.height };
  const newFile = new File(stampedDir(), `${id}-${Date.now()}.jpg`);
  newFile.write(jpegBytes);

  target.uri = newFile.uri;
  target.width = meta.width;
  target.height = meta.height;
  await persist(all);

  let undone = false;
  let finalized = false;
  const timer = setTimeout(() => {
    finalized = true;
    if (!undone && old.uri !== target.photoUri) deleteFile(old.uri);
  }, UNDO_WINDOW_MS);

  const undo = async () => {
    if (undone || finalized) return;
    undone = true;
    clearTimeout(timer);
    const current = await readAll();
    const entry = current.find((s) => s.id === id);
    if (entry) {
      entry.uri = old.uri;
      entry.width = old.width;
      entry.height = old.height;
      await persist(current);
    }
    deleteFile(newFile.uri);
  };

  return { photo: { ...target }, undo };
}
