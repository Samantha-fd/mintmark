import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    Image,
    ImageBackground,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { makeCheckerTile } from '@/lib/image-processing';
import { listLogos } from '@/lib/logo-store';
import type { Logo } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';

const PAGE_SIZE = 12;

type SortKey = 'newest' | 'oldest' | 'az' | 'za';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'az', label: 'A–Z' },
  { key: 'za', label: 'Z–A' },
];

export default function LogoLibraryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);
  const checker = useMemo(
    () => makeCheckerTile(theme.checkerLight, theme.checkerDark),
    [theme],
  );

  useFocusEffect(
    useCallback(() => {
      listLogos().then(setLogos);
    }, []),
  );

  const sorted = useMemo(() => {
    const copy = [...logos];
    switch (sort) {
      case 'newest':
        return copy.sort((a, b) => b.createdAt - a.createdAt);
      case 'oldest':
        return copy.sort((a, b) => a.createdAt - b.createdAt);
      case 'az':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'za':
        return copy.sort((a, b) => b.name.localeCompare(a.name));
    }
  }, [logos, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const chooseSort = (key: SortKey) => {
    setSort(key);
    setPage(0);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.sortRow}>
        {SORTS.map(({ key, label }) => {
          const active = key === sort;
          return (
            <Pressable
              key={key}
              onPress={() => chooseSort(key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.accent : theme.surface,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? theme.onAccent : theme.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={pageItems}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No logos yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Create a logo from any picture, then add it to your photos.
            </Text>
            <View style={styles.emptyAction}>
              <Button
                label="Create logo"
                icon="add-circle-outline"
                onPress={() => router.push('/create')}
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
            onPress={() => router.push({ pathname: '/logo/[id]', params: { id: item.id } })}
          >
            <ImageBackground
              source={{ uri: checker }}
              resizeMode="repeat"
              style={styles.thumbWrap}
              imageStyle={styles.thumbBg}
            >
              <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="contain" />
            </ImageBackground>
            <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.cardHint, { color: theme.textMuted }]}>
              Tap to view
            </Text>
          </Pressable>
        )}
      />

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        {pageCount > 1 && (
          <View style={styles.pagination}>
            <Pressable
              onPress={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={[
                styles.pageButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
                currentPage === 0 && styles.pageButtonDisabled,
              ]}
            >
              <Text style={[styles.pageButtonLabel, { color: theme.text }]}>‹ Prev</Text>
            </Pressable>
            <Text style={[styles.pageIndicator, { color: theme.textMuted }]}>
              Page {currentPage + 1} of {pageCount}
            </Text>
            <Pressable
              onPress={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              disabled={currentPage >= pageCount - 1}
              style={[
                styles.pageButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
                currentPage >= pageCount - 1 && styles.pageButtonDisabled,
              ]}
            >
              <Text style={[styles.pageButtonLabel, { color: theme.text }]}>Next ›</Text>
            </Pressable>
          </View>
        )}
        <Button
          label="New logo"
          icon="add-circle-outline"
          onPress={() => router.push('/create')}
        />
        <Button
          label="Text watermark"
          icon="text-outline"
          variant="secondary"
          onPress={() => router.push('/create-text')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  list: { padding: 16, flexGrow: 1 },
  row: { gap: 12 },
  card: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 16,
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  thumbWrap: {
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBg: { borderRadius: 10 },
  thumb: { width: '88%', height: '88%' },
  cardName: { marginTop: 8, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  cardHint: { marginTop: 2, fontFamily: 'Inter_400Regular', fontSize: 11 },
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
  footer: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pageIndicator: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
