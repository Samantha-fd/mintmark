import * as MediaLibrary from 'expo-media-library';

/** Gallery album that all stamped photos are collected into. */
export const ALBUM_NAME = 'Mintmark';

/**
 * Saves the file into the device gallery, inside the "Mintmark" album.
 * Throws if the user refuses photo permission.
 */
export async function saveToGalleryAlbum(fileUri: string): Promise<void> {
  // photos only — the default set also asks for audio/video, which are not
  // declared in the manifest (video stamping is shelved) and get rejected
  let perm: MediaLibrary.EXPermissionResponse;
  try {
    perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  } catch {
    // media library is entirely unavailable in Expo Go on Android
    throw new Error(
      'Saved in the app only — the Expo Go preview cannot write to the gallery. Use Share, or the installed app.',
    );
  }
  if (!perm.granted) {
    throw new Error('Allow photo access to also save to your gallery.');
  }
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  try {
    const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
    }
  } catch {
    // Album grouping failed (varies by Android version) — the photo is
    // still saved in the gallery, just not filed into the album.
  }
}
