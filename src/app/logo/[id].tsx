import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBar } from '@/components/action-bar';
import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { makeCheckerTile } from '@/lib/image-processing';
import { deleteLogo, getLogo, renameLogo } from '@/lib/logo-store';
import { encodePhotos } from '@/lib/photo-params';
import type { Logo } from '@/lib/types';

export default function LogoDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [logo, setLogo] = useState<Logo | null>(null);
  const [name, setName] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const checker = useMemo(
    () => makeCheckerTile(theme.checkerLight, theme.checkerDark),
    [theme],
  );

  // reload whenever the screen regains focus, so edits show immediately
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getLogo(id).then((l) => {
        setLogo(l ?? null);
        if (l) setName(l.name);
      });
    }, [id]),
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const commitName = async () => {
    if (!logo || renaming) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === logo.name) return;
    setRenaming(true);
    try {
      await renameLogo(logo.id, trimmed);
      setLogo({ ...logo, name: trimmed });
      toast('Logo renamed');
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setRenaming(false);
    }
  };

  const useOnPhoto = async () => {
    if (!logo) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      orderedSelection: true,
    });
    if (result.canceled) return;
    router.push({
      pathname: '/editor',
      params: {
        logoId: logo.id,
        photos: encodePhotos(result.assets),
      },
    });
  };

  const confirmDelete = () => {
    if (!logo) return;
    Alert.alert('Delete logo?', `"${logo.name}" will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLogo(logo.id);
          toast('Logo deleted');
          router.back();
        },
      },
    ]);
  };

  if (!logo) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // Android already resizes the window for the keyboard — adding
      // "padding" on top of that created a double gap above the keyboard
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: keyboardVisible ? 16 : 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={{ uri: checker }}
          resizeMode="repeat"
          style={[styles.preview, { borderColor: theme.border }]}
          imageStyle={styles.previewBg}
        >
          <Image source={{ uri: logo.uri }} style={styles.previewImage} resizeMode="contain" />
        </ImageBackground>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={commitName}
            onSubmitEditing={commitName}
            returnKeyType="done"
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholderTextColor={theme.textMuted}
          />
          {logo && name.trim() !== logo.name && (
            <Button label="Save name" icon="checkmark" onPress={commitName} disabled={renaming} />
          )}
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {logo.width} × {logo.height} px · created{' '}
            {new Date(logo.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.actions}>
          <ActionBar
            items={[
              {
                icon: 'image-outline',
                label: 'Use on photo',
                tone: 'accent',
                onPress: useOnPhoto,
              },
              {
                icon: 'create-outline',
                label: 'Edit',
                onPress: () =>
                  router.push({ pathname: '/create', params: { editId: logo.id } }),
              },
              {
                icon: 'trash-outline',
                label: 'Delete',
                tone: 'danger',
                onPress: confirmDelete,
              },
            ]}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16, flexGrow: 1 },
  preview: {
    height: 320,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBg: { borderRadius: 16 },
  previewImage: { width: '90%', height: '90%' },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  actions: { gap: 10, marginTop: 4 },
});
