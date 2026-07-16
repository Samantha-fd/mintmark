import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBar, type ActionBarItem } from '@/components/action-bar';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { encodePhotoAsJpeg } from '@/lib/image-processing';
import { ALBUM_NAME, saveToGalleryAlbum } from '@/lib/media';
import { getSettings } from '@/lib/settings';
import { getStamped, removeStamped, updateStampedWithUndo } from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

export default function StampedDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photo, setPhoto] = useState<StampedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastUndo, setLastUndo] = useState<(() => Promise<void>) | null>(null);

  // reload on focus so edits made in the editor show immediately
  useFocusEffect(
    useCallback(() => {
      if (id) getStamped(id).then((p) => setPhoto(p ?? null));
    }, [id]),
  );

  const isVideo = photo?.mediaType === 'video';

  const share = async () => {
    if (!photo) return;
    if (await Sharing.isAvailableAsync()) {
      // dialogTitle forces Android's full share chooser instead of jumping
      // straight to the most-recently-used app
      await Sharing.shareAsync(photo.uri, {
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        dialogTitle: 'Share your marked photo',
      });
    } else {
      toast('Sharing is not available on this device', 'error');
    }
  };

  const saveToGallery = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      await saveToGalleryAlbum(photo.uri);
      toast(`Saved to the “${ALBUM_NAME}” album in your phone gallery`);
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addAnotherLogo = () => {
    if (!photo) return;
    router.push({
      pathname: '/pick-logo',
      params: {
        photoUri: photo.uri,
        photoWidth: String(photo.width),
        photoHeight: String(photo.height),
        // updates this stamped photo instead of creating a duplicate
        stampedId: photo.id,
      },
    });
  };

  const removeLogo = async () => {
    if (!photo || !photo.photoUri) return;
    setBusy(true);
    try {
      const bytes = await encodePhotoAsJpeg(photo.photoUri);
      const { photo: updated, undo } = await updateStampedWithUndo(photo.id, bytes, {
        width: photo.width,
        height: photo.height,
      });
      setPhoto({ ...updated });
      const undoAndRefresh = async () => {
        await undo();
        setLastUndo(null);
        const restored = await getStamped(photo.id);
        if (restored) setPhoto({ ...restored });
      };
      setLastUndo(() => undoAndRefresh);
      toast('Watermarks removed — back to the original photo', 'success', {
        label: 'Undo',
        onPress: undoAndRefresh,
      });
      if ((await getSettings()).phoneGalleryBackup) {
        // gallery copy is a bonus; the Save action covers failures
        try {
          await saveToGalleryAlbum(updated.uri);
        } catch {
          // e.g. Expo Go can't write to the gallery — already explained elsewhere
        }
      }
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!photo) return;
    const undo = await removeStamped([photo.id]);
    toast('Moved to Recently deleted', 'success', {
      label: 'Undo',
      onPress: () => {
        undo();
      },
    });
    router.back();
  };

  const more = () => {
    Alert.alert('More', undefined, [
      ...(lastUndo
        ? [{ text: 'Undo last change', onPress: () => lastUndo() }]
        : []),
      { text: 'Remove watermark', onPress: removeLogo },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (!photo) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const actions: ActionBarItem[] = [
    { icon: 'share-outline', label: 'Share', tone: 'accent', onPress: share, disabled: busy },
    { icon: 'download-outline', label: 'Save', onPress: saveToGallery, disabled: busy },
    ...(!isVideo
      ? [
          {
            icon: 'add-circle-outline',
            label: 'Add watermark',
            onPress: addAnotherLogo,
            disabled: busy,
          } as ActionBarItem,
        ]
      : []),
    { icon: 'trash-outline', label: 'Delete', onPress: confirmDelete, disabled: busy },
    ...(!isVideo && photo.photoUri
      ? [{ icon: 'ellipsis-horizontal', label: 'More', onPress: more, disabled: busy } as ActionBarItem]
      : []),
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingBottom: 12 + insets.bottom },
      ]}
    >
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        {new Date(photo.createdAt).toLocaleDateString()} · {photo.width} ×{' '}
        {photo.height} px
      </Text>
      <View style={styles.previewWrap}>
        {isVideo ? (
          <VideoPreview uri={photo.uri} />
        ) : (
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
        )}
      </View>
      <ActionBar items={actions} />
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView player={player} style={styles.preview} contentFit="contain" nativeControls />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 12, gap: 10 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  previewWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
});
