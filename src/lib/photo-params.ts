export type PickedPhoto = { uri: string; width: number; height: number };

type PhotoParams = {
  photos?: string;
  photoUri?: string;
  photoWidth?: string;
  photoHeight?: string;
};

/** Serializes picked photos for handover between screens via router params. */
export function encodePhotos(
  assets: { uri: string; width: number; height: number }[],
): string {
  return JSON.stringify(
    assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })),
  );
}

/**
 * Reads photos from router params — either the multi-photo `photos` JSON or
 * the legacy single-photo `photoUri`/`photoWidth`/`photoHeight` trio (still
 * used when re-editing an existing stamped photo).
 */
export function decodePhotos(params: PhotoParams): PickedPhoto[] {
  if (params.photos) {
    try {
      const arr = JSON.parse(params.photos) as PickedPhoto[];
      if (Array.isArray(arr)) {
        return arr.filter(
          (p) => p && typeof p.uri === 'string' && p.width > 0 && p.height > 0,
        );
      }
    } catch {
      // fall through to the single-photo params
    }
  }
  if (params.photoUri && params.photoWidth && params.photoHeight) {
    return [
      {
        uri: params.photoUri,
        width: Number(params.photoWidth),
        height: Number(params.photoHeight),
      },
    ];
  }
  return [];
}
