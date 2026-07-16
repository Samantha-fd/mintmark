import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { encodePhotos } from '@/lib/photo-params';
import { listDeleted, listStamped, onStampedChange, removeStamped } from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

export default function StampedLibraryScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<StampedPhoto[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const selecting = selected.size > 0;

  const refresh = useCallback(() => {
    listStamped().then(setPhotos);
    listDeleted().then((d) => setDeletedCount(d.length));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      setSelected(new Set());
    }, [refresh]),
  );

  // refresh when the store changes underneath us (e.g. Undo from a toast)
  useEffect(() => onStampedChange(refresh), [refresh]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPhotos = () => photos.filter((p) => selected.has(p.id));

  const shareSelected = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      toast('Sharing is not available on this device', 'error');
      return;
    }
    setSharing(true);
    try {
      // the system sheet takes one file at a time — share them in sequence
      for (const p of selectedPhotos()) {
        await Sharing.shareAsync(p.uri, {
          mimeType: p.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          dialogTitle: 'Share your marked photo',
        });
      }
      setSelected(new Set());
    } catch {
      // the user closed the share sheet mid-way — nothing to clean up
    } finally {
      setSharing(false);
    }
  };

  const editSelected = () => {
    const all = selectedPhotos();
    const chosen = all.filter((p) => p.mediaType !== 'video');
    if (chosen.length === 0) {
      toast('Videos can’t take another mark — pick photos to re-stamp', 'info');
      return;
    }
    if (chosen.length < all.length) {
      toast('Skipping videos — they can’t take another mark', 'info');
    }
    router.push({
      pathname: '/pick-logo',
      params: {
        photos: encodePhotos(chosen),
        // updates these stamped photos instead of creating duplicates
        stampedIds: JSON.stringify(chosen.map((p) => p.id)),
      },
    });
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    const undo = await removeStamped(ids);
    setSelected(new Set());
    toast(
      ids.length === 1 ? 'Logo photo deleted' : `${ids.length} logo photos deleted`,
      'success',
      { label: 'Undo', onPress: () => undo() },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={3}
        extraData={selected}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: (selecting ? 88 : 16) + insets.bottom },
        ]}
        ListHeaderComponent={
          deletedCount > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.trashRow,
                { backgroundColor: theme.surface },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push('/recently-deleted')}
            >
              <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.trashLabel, { color: theme.text }]}>
                Recently deleted
              </Text>
              <Text style={[styles.trashCount, { color: theme.textMuted }]}>
                {deletedCount}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No logo photos yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Photos you add a logo to will appear here and in your gallery.
            </Text>
            <View style={styles.emptyAction}>
              <Button
                label="Add logo to photo"
                icon="image-outline"
                onPress={() => router.push('/')}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              style={styles.cell}
              onPress={() =>
                selecting
                  ? toggle(item.id)
                  : router.push({ pathname: '/stamped/[id]', params: { id: item.id } })
              }
              onLongPress={() => toggle(item.id)}
            >
              <Image
                source={{ uri: item.thumbUri ?? item.uri }}
                style={[
                  StyleSheet.absoluteFill as object,
                  isSelected && { opacity: 0.65 },
                ]}
              />
              {item.mediaType === 'video' && (
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={14} color="#FFFFFF" />
                </View>
              )}
              {isSelected && (
                <>
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { borderWidth: 2.5, borderColor: theme.accent },
                    ]}
                  />
                  <View style={styles.check}>
                    <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                  </View>
                </>
              )}
            </Pressable>
          );
        }}
      />

      {selecting && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: theme.surface,
              bottom: 12 + insets.bottom,
            },
          ]}
        >
          <Pressable onPress={() => setSelected(new Set())} hitSlop={8} style={styles.barItem}>
            <Ionicons name="close" size={22} color={theme.textMuted} />
          </Pressable>
          <Text style={[styles.barCount, { color: theme.text }]}>
            {selected.size} selected
          </Text>
          <View style={styles.barActions}>
            <Pressable
              onPress={shareSelected}
              disabled={sharing}
              hitSlop={8}
              style={[styles.barItem, sharing && { opacity: 0.5 }]}
            >
              <Ionicons name="share-outline" size={22} color={theme.accent} />
              <Text style={[styles.barLabel, { color: theme.accent }]}>Share</Text>
            </Pressable>
            <Pressable onPress={editSelected} hitSlop={8} style={styles.barItem}>
              <Ionicons name="brush-outline" size={22} color={theme.accent} />
              <Text style={[styles.barLabel, { color: theme.accent }]}>Add watermark</Text>
            </Pressable>
            <Pressable onPress={deleteSelected} hitSlop={8} style={styles.barItem}>
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
              <Text style={[styles.barLabel, { color: theme.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 2, flexGrow: 1 },
  row: { gap: 2 },
  cell: {
    flex: 1 / 3,
    aspectRatio: 1,
    marginBottom: 2,
    overflow: 'hidden',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 11,
    backgroundColor: '#FFFFFFCC',
  },
  playBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000A0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  barCount: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  barActions: { flexDirection: 'row', gap: 18 },
  barItem: { alignItems: 'center', gap: 2 },
  barLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  trashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    margin: 10,
    marginBottom: 8,
  },
  trashLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  trashCount: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyAction: { marginTop: 20, alignSelf: 'stretch' },
});
