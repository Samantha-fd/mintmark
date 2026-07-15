import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import {
  listDeleted,
  onStampedChange,
  purgeStamped,
  restoreStamped,
  TRASH_RETENTION_DAYS,
} from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(photo: StampedPhoto): number {
  const elapsed = Date.now() - (photo.deletedAt ?? Date.now());
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsed / DAY_MS));
}

export default function RecentlyDeletedScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<StampedPhoto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selecting = selected.size > 0;

  useFocusEffect(
    useCallback(() => {
      listDeleted().then(setPhotos);
      setSelected(new Set());
    }, []),
  );
  useEffect(() => onStampedChange(() => listDeleted().then(setPhotos)), []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restore = async () => {
    const ids = [...selected];
    await restoreStamped(ids);
    setSelected(new Set());
    toast(ids.length === 1 ? 'Photo restored' : `${ids.length} photos restored`);
  };

  const deleteForever = () => {
    const ids = [...selected];
    Alert.alert(
      ids.length === 1 ? 'Delete photo forever?' : `Delete ${ids.length} photos forever?`,
      'This cannot be undone. Copies already saved to your gallery stay there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            await purgeStamped(ids);
            setSelected(new Set());
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.intro, { color: theme.textMuted }]}>
        Deleted photos stay here for {TRASH_RETENTION_DAYS} days, then disappear
        for good. Tap to select.
      </Text>
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trash-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Nothing here
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Photos you delete will wait here for {TRASH_RETENTION_DAYS} days
              in case you change your mind.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable style={styles.cell} onPress={() => toggle(item.id)}>
              <Image
                source={{ uri: item.uri }}
                style={[
                  StyleSheet.absoluteFill as object,
                  isSelected && { opacity: 0.65 },
                ]}
              />
              <View style={styles.daysPill}>
                <Text style={styles.daysLabel}>{daysLeft(item)}d</Text>
              </View>
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
            { backgroundColor: theme.surface, bottom: 12 + insets.bottom },
          ]}
        >
          <Pressable onPress={() => setSelected(new Set())} hitSlop={8} style={styles.barItem}>
            <Ionicons name="close" size={22} color={theme.textMuted} />
          </Pressable>
          <Text style={[styles.barCount, { color: theme.text }]}>
            {selected.size} selected
          </Text>
          <View style={styles.barActions}>
            <Pressable onPress={restore} hitSlop={8} style={styles.barItem}>
              <Ionicons name="refresh-outline" size={22} color={theme.accent} />
              <Text style={[styles.barLabel, { color: theme.accent }]}>Restore</Text>
            </Pressable>
            <Pressable onPress={deleteForever} hitSlop={8} style={styles.barItem}>
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
              <Text style={[styles.barLabel, { color: theme.danger }]}>
                Delete forever
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
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
  daysPill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#000000A0',
  },
  daysLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#FFFFFF' },
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
});
