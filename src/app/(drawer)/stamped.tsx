import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { listStamped } from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

export default function StampedLibraryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<StampedPhoto[]>([]);

  useFocusEffect(
    useCallback(() => {
      listStamped().then(setPhotos);
    }, []),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: 16 + insets.bottom }]}
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
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() =>
              router.push({ pathname: '/stamped/[id]', params: { id: item.id } })
            }
          >
            <Image source={{ uri: item.uri }} style={styles.thumb} />
            <Text style={[styles.cardHint, { color: theme.textMuted }]}>
              {new Date(item.createdAt).toLocaleDateString()} · tap to view
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, flexGrow: 1 },
  row: { gap: 12 },
  card: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 16,
    padding: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  thumb: { aspectRatio: 1, borderRadius: 10, width: '100%' },
  cardHint: {
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
  },
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
