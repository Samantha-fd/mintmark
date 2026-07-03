import { useHeaderHeight } from '@react-navigation/elements';
import type { SkImage } from '@shopify/react-native-skia';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Slider } from '@/components/slider';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import {
    encodePng,
    makeCheckerTile,
    processLogo,
    toDataUri,
} from '@/lib/image-processing';
import { getLogo, saveLogo, updateLogo } from '@/lib/logo-store';

export default function CreateLogoScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(false);
  const [tolerance, setTolerance] = useState(25);
  const [liveTolerance, setLiveTolerance] = useState(25);
  const [name, setName] = useState('My logo');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const processedRef = useRef<SkImage | null>(null);
  const jobRef = useRef(0);

  const checker = useMemo(
    () => makeCheckerTile(theme.checkerLight, theme.checkerDark),
    [theme],
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      setSourceUri(result.assets[0].uri);
    } else if (!sourceUri) {
      router.back();
    }
  }, [sourceUri]);

  useEffect(() => {
    if (!editId) {
      pickImage();
      return;
    }
    // edit mode: start from the logo's original picture and settings
    getLogo(editId).then((logo) => {
      if (!logo) {
        toast('Logo not found', 'error');
        router.back();
        return;
      }
      setName(logo.name);
      if (logo.options) {
        setRemoveBg(logo.options.removeBg);
        setTolerance(logo.options.tolerance);
        setLiveTolerance(logo.options.tolerance);
      }
      setSourceUri(logo.sourceUri ?? logo.uri);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!sourceUri) return;
    const job = ++jobRef.current;
    setBusy(true);
    // let the spinner paint before the CPU-heavy work starts
    const timer = setTimeout(async () => {
      try {
        const image = await processLogo(sourceUri, { removeBg, tolerance });
        if (jobRef.current !== job) return; // superseded by newer settings
        processedRef.current = image;
        setPreviewUri(toDataUri(image));
      } catch (e) {
        if (jobRef.current === job) {
          toast(String(e instanceof Error ? e.message : e), 'error');
        }
      } finally {
        if (jobRef.current === job) setBusy(false);
      }
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUri, removeBg, tolerance]);

  const save = async () => {
    const image = processedRef.current;
    if (!image) return;
    setSaving(true);
    try {
      const meta = {
        name: name.trim() || 'My logo',
        width: image.width(),
        height: image.height(),
      };
      if (editId) {
        await updateLogo(editId, encodePng(image), {
          ...meta,
          options: { removeBg, tolerance },
        });
        toast('Logo updated');
      } else {
        await saveLogo(
          encodePng(image),
          meta,
          sourceUri ? { uri: sourceUri, removeBg, tolerance } : undefined,
        );
        toast('Logo saved to your library');
      }
      router.back();
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // Android already resizes the window for the keyboard — adding
      // "padding" on top of that created a double gap above the keyboard
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen options={{ title: editId ? 'Edit Logo' : 'New Logo' }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: keyboardVisible ? 16 : 32 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={{ uri: checker }}
          resizeMode="repeat"
          style={[styles.preview, { borderColor: theme.border }]}
          imageStyle={styles.previewBg}
        >
          {previewUri && !busy ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <ActivityIndicator size="large" color={theme.accent} />
          )}
        </ImageBackground>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          The checkered area shows what will be transparent when added to a
          photo.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
          <View style={[styles.panel, { backgroundColor: theme.surface }]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.label, { color: theme.text }]}>Remove background</Text>
                <Text style={[styles.sublabel, { color: theme.textMuted }]}>
                  Erase the solid colour around your logo
                </Text>
              </View>
              <Switch
                value={removeBg}
                onValueChange={setRemoveBg}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.surface}
              />
            </View>

            {removeBg && (
              <View style={styles.sliderBlock}>
                <Text style={[styles.sublabel, { color: theme.textMuted }]}>
                  Strength: {Math.round(liveTolerance)}
                </Text>
                <Slider
                  value={tolerance}
                  onChange={setLiveTolerance}
                  onCommit={(v) => {
                    setLiveTolerance(v);
                    setTolerance(Math.round(v));
                  }}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="e.g. Cake logo"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.actions}>
          {!editId && (
            <Button
              label="Change picture"
              icon="image-outline"
              variant="secondary"
              onPress={pickImage}
            />
          )}
          <Button
            label={editId ? 'Save changes' : 'Save logo'}
            icon="checkmark"
            onPress={save}
            busy={saving}
            disabled={busy || !previewUri}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  preview: {
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBg: { borderRadius: 16 },
  previewImage: { width: '92%', height: '92%' },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panel: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  sublabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  sliderBlock: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  actions: { gap: 10, marginTop: 4 },
});
