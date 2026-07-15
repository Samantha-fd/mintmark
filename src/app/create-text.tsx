import { useHeaderHeight } from '@react-navigation/elements';
import type { SkImage } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import {
  encodePng,
  makeCheckerTile,
  renderTextLogo,
  toDataUri,
} from '@/lib/image-processing';
import { saveLogo } from '@/lib/logo-store';

const COLORS = ['#FFFFFF', '#1D1A16', '#F1EAE1', '#C4704F', '#D9A93C'];
const QUICK_CHARS = ['©', '@'];

export default function CreateTextWatermarkScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [text, setText] = useState('© My brand');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const processedRef = useRef<SkImage | null>(null);
  const jobRef = useRef(0);

  const checker = useMemo(
    () => makeCheckerTile(theme.checkerLight, theme.checkerDark),
    [theme],
  );

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      processedRef.current = null;
      setPreviewUri(null);
      return;
    }
    const job = ++jobRef.current;
    setBusy(true);
    // small debounce so we don't re-render on every keystroke
    const timer = setTimeout(async () => {
      try {
        const image = await renderTextLogo(trimmed, color);
        if (jobRef.current !== job) return; // superseded by newer input
        processedRef.current = image;
        setPreviewUri(toDataUri(image));
      } catch (e) {
        if (jobRef.current === job) {
          toast(String(e instanceof Error ? e.message : e), 'error');
        }
      } finally {
        if (jobRef.current === job) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, color]);

  const save = async () => {
    const image = processedRef.current;
    if (!image) return;
    setSaving(true);
    try {
      await saveLogo(encodePng(image), {
        name: text.trim(),
        width: image.width(),
        height: image.height(),
      });
      toast('Text watermark saved to your library');
      router.back();
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={{ uri: checker }}
          resizeMode="repeat"
          style={[styles.preview, { borderColor: theme.border }]}
          imageStyle={styles.previewBg}
        >
          {busy ? (
            <ActivityIndicator size="large" color={theme.accent} />
          ) : previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <Text style={[styles.previewEmpty, { color: theme.textMuted }]}>
              Type something below
            </Text>
          )}
        </ImageBackground>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Your name, @handle, or © line — it goes into your logo library and
          stamps onto photos like any logo.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Text</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="e.g. © Amara's Kitchen"
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          <View style={styles.chipRow}>
            {QUICK_CHARS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setText((t) => (t.includes(c) ? t : `${c} ${t}`.trim()))}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.accentSoft },
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Text style={[styles.chipLabel, { color: theme.accent }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Colour</Text>
          <View style={styles.swatchRow}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c, borderColor: theme.border },
                  color === c && { borderColor: theme.accent, borderWidth: 3 },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.sublabel, { color: theme.textMuted }]}>
            White works on most photos — you set the transparency later, when
            stamping.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Save watermark"
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
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBg: { borderRadius: 16 },
  previewImage: { width: '88%', height: '70%' },
  previewEmpty: { fontFamily: 'Inter_400Regular', fontSize: 14 },
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
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  chipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  swatchRow: { flexDirection: 'row', gap: 12 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  sublabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  actions: { gap: 10, marginTop: 4 },
});
