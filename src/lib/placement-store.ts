import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'placements:v1';

/**
 * A logo placement remembered independently of any particular photo: the
 * centre is stored as fractions of the photo's displayed rect and the width
 * as a fraction of its shorter side, so "same as last time" lands
 * proportionally on a photo of any size or aspect ratio.
 */
export type SavedPlacement = {
  /** logo centre as fractions of the photo rect (0–1) */
  cx: number;
  cy: number;
  /** logo width as a fraction of the photo's shorter displayed side */
  widthFrac: number;
  /** radians */
  rotation: number;
  /** 0–1 */
  opacity: number;
};

type PlacementMap = Record<string, SavedPlacement>;

async function readAll(): Promise<PlacementMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PlacementMap) : {};
}

export async function getPlacement(logoId: string): Promise<SavedPlacement | undefined> {
  return (await readAll())[logoId];
}

export async function savePlacement(
  logoId: string,
  placement: SavedPlacement,
): Promise<void> {
  const all = await readAll();
  all[logoId] = placement;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
