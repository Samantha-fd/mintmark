import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { encodePhotoAsJpeg } from '@/lib/image-processing';
import { ALBUM_NAME, saveToGalleryAlbum } from '@/lib/media';
import { deleteStamped, getStamped, updateStamped } from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

export default function StampedDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photo, setPhoto] = useState<StampedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  // reload on focus so edits made in the editor show immediately
  useFocusEffect(
    useCallback(() => {
      if (id) getStamped(id).then((p) => setPhoto(p ?? null));
    }, [id]),
  );

  const share = async () => {
    if (!photo) return;
    if (await Sharing.isAvailableAsync()) {
      // dialogTitle forces Android's full share chooser instead of jumping
      // straight to the most-recently-used app
      await Sharing.shareAsync(photo.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share your logo photo',
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
      toast(`Saved to the “${ALBUM_NAME}” album in your gallery`);
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
    setRemoving(true);
    try {
      const bytes = await encodePhotoAsJpeg(photo.photoUri);
      const updated = await updateStamped(photo.id, bytes, {
        width: photo.width,
        height: photo.height,
      });
      setPhoto({ ...updated });
      toast('Logos removed — back to the original photo');
      // gallery copy is a bonus; the dedicated button covers failures
      try {
        await saveToGalleryAlbum(updated.uri);
      } catch {
        // e.g. Expo Go can't write to the gallery — already explained elsewhere
      }
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setRemoving(false);
    }
  };

  const confirmDelete = () => {
    if (!photo) return;
    Alert.alert(
      'Delete logo photo?',
      'It will be removed from the app. Copies already saved to your gallery stay there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteStamped(photo.id);
            toast('Logo photo deleted');
            router.back();
          },
        },
      ],
    );
  };

  if (!photo) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingBottom: 16 + insets.bottom },
      ]}
    >
      <View style={[styles.previewWrap, { borderColor: theme.border }]}>
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
      </View>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        {photo.width} × {photo.height} px ·{' '}
        {new Date(photo.createdAt).toLocaleString()}
      </Text>

      <View style={styles.actions}>
        <Button label="Share" icon="share-outline" onPress={share} />
        <Button
          label="Save to gallery"
          icon="download-outline"
          variant="secondary"
          onPress={saveToGallery}
          busy={busy}
        />
        {photo.photoUri && (
          <Button
            label="Remove logo"
            icon="close-circle-outline"
            variant="secondary"
            onPress={removeLogo}
            busy={removing}
          />
        )}
        <Button
          label="Add another logo"
          icon="add-circle-outline"
          variant="secondary"
          onPress={addAnotherLogo}
        />
        <Button
          label="Delete"
          icon="trash-outline"
          variant="secondary"
          onPress={confirmDelete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16, gap: 10 },
  previewWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  preview: { width: '100%', height: '100%' },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  actions: { gap: 8 },
});
