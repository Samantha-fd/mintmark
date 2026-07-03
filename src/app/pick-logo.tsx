import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

export default function PickLogoScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    photoUri: string;
    photoWidth: string;
    photoHeight: string;
    stampedId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [logos, setLogos] = useState<Logo[]>([]);
  const checker = useMemo(
    () => makeCheckerTile(theme.checkerLight, theme.checkerDark),
    [theme],
  );

  useFocusEffect(
    useCallback(() => {
      listLogos().then(setLogos);
    }, []),
  );

  const choose = (logo: Logo) => {
    router.replace({
      pathname: '/editor',
      params: {
        logoId: logo.id,
        photoUri: params.photoUri,
        photoWidth: params.photoWidth,
        photoHeight: params.photoHeight,
        stampedId: params.stampedId,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.intro, { color: theme.textMuted }]}>
        Choose a logo for this photo
      </Text>
      <FlatList
        data={logos}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: 16 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No logos yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
              Create a logo first, then add it to a photo.
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
              { backgroundColor: theme.surface },
            ]}
            onPress={() => choose(item)}
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
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
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
