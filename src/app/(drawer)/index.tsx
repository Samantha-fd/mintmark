import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { listLogos } from '@/lib/logo-store';

export default function HomeScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [logoCount, setLogoCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      listLogos().then((l) => setLogoCount(l.length));
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
    });
    if (result.canceled) return;
    const a = result.assets[0];
    router.push({
      pathname: '/pick-logo',
      params: {
        photoUri: a.uri,
        photoWidth: String(a.width),
        photoHeight: String(a.height),
      },
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
              ? 'Pick a photo and overlay your logo'
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
});
