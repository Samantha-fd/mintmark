import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { listLogos } from '@/lib/logo-store';
import { encodePhotos } from '@/lib/photo-params';
import { listStamped } from '@/lib/stamped-store';
import type { StampedPhoto } from '@/lib/types';

export default function HomeScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [logoCount, setLogoCount] = useState(0);
  const [recent, setRecent] = useState<StampedPhoto[]>([]);

  useFocusEffect(
    useCallback(() => {
      listLogos().then((l) => setLogoCount(l.length));
      listStamped().then((s) => setRecent(s.slice(0, 8)));
    }, []),
  );

  const startStamping = async () => {
    if (logoCount === 0) {
      toast('Create a logo first — you have none saved yet', 'error');
      router.push('/create');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      orderedSelection: true,
    });
    if (result.canceled) return;
    router.push({
      pathname: '/pick-logo',
      params: { photos: encodePhotos(result.assets) },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ExpoImage
        source={require('@/assets/images/splash-icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={[styles.tagline, { color: theme.textMuted }]}>
        Add your logo to any photo, cleanly.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.surface },
          pressed && styles.pressed,
        ]}
        onPress={startStamping}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="image-outline" size={28} color={theme.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Add logo to photo
          </Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            {logoCount > 0
              ? 'Pick one or more photos and overlay your logo'
              : 'Create a logo first'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.surface },
          pressed && styles.pressed,
        ]}
        onPress={() => router.push('/create')}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="add-circle-outline" size={28} color={theme.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            New logo
          </Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Make any picture transparent and ready
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.surface },
          pressed && styles.pressed,
        ]}
        onPress={() => router.push('/create-text')}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="text-outline" size={28} color={theme.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Text watermark
          </Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>
            Your name or @handle as a stamp
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </Pressable>

      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: theme.text }]}>Recent</Text>
            <Pressable
              onPress={() => router.push('/stamped')}
              hitSlop={8}
              style={styles.recentLink}
            >
              <Text style={[styles.recentLinkLabel, { color: theme.accent }]}>
                Gallery
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.accent} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentStrip}
          >
            {recent.map((p) => (
              <Pressable
                key={p.id}
                onPress={() =>
                  router.push({ pathname: '/stamped/[id]', params: { id: p.id } })
                }
              >
                <ExpoImage source={{ uri: p.uri }} style={styles.recentThumb} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14 },
  logo: {
    width: 88,
    height: 88,
    alignSelf: 'center',
    marginVertical: 8,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 18,
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.8 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  cardBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  recentSection: { marginTop: 'auto', gap: 8, paddingTop: 8 },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  recentLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  recentLinkLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  recentStrip: { gap: 8 },
  recentThumb: { width: 74, height: 74, borderRadius: 10 },
});
