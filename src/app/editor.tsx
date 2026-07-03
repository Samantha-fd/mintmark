import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Slider } from '@/components/slider';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { encodePhotoAsJpeg, renderStampedPhoto } from '@/lib/image-processing';
import { getLogo } from '@/lib/logo-store';
import { ALBUM_NAME, saveToGalleryAlbum } from '@/lib/media';
import { saveStamped, updateStamped } from '@/lib/stamped-store';
import type { Logo } from '@/lib/types';

type Photo = { uri: string; width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number };

/** "contain" fit of the photo inside the available container */
function fitRect(container: { w: number; h: number }, photo: Photo): Rect {
  const scale = Math.min(container.w / photo.width, container.h / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  return { x: (container.w - w) / 2, y: (container.h - h) / 2, w, h };
}

export default function EditorScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    logoId: string;
    photoUri?: string;
    photoWidth?: string;
    photoHeight?: string;
    stampedId?: string;
  }>();
  const [logo, setLogo] = useState<Logo | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  // logo placement, in on-screen pixels relative to the photo rect centre
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  useEffect(() => {
    if (params.logoId) getLogo(params.logoId).then((l) => setLogo(l ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.logoId]);

  useEffect(() => {
    // photo handed over by the previous screen (home / pick-logo / detail)
    if (params.photoUri && params.photoWidth && params.photoHeight) {
      setPhoto({
        uri: params.photoUri,
        width: Number(params.photoWidth),
        height: Number(params.photoHeight),
      });
      return;
    }
    // otherwise ask for one
    (async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) {
        router.back();
        return;
      }
      const a = result.assets[0];
      setPhoto({ uri: a.uri, width: a.width, height: a.height });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rect = photo && container ? fitRect(container, photo) : null;
  const baseLogoW = rect ? rect.w * 0.4 : 100;
  const logoAspect = logo ? logo.height / logo.width : 1;

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.05, startScale.value * e.scale);
    });
  const rotate = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = startRotation.value + e.rotation;
    });
  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  const save = async () => {
    if (!photo || !rect) return;
    setExporting(true);
    try {
      const bytes = logo
        ? await renderStampedPhoto(photo.uri, logo.uri, {
            displayWidth: rect.w,
            centerX: rect.w / 2 + tx.value,
            centerY: rect.h / 2 + ty.value,
            logoDisplayWidth: baseLogoW * scale.value,
            rotation: rotation.value,
            opacity: opacity.value,
          })
        : await encodePhotoAsJpeg(photo.uri);
      const meta = { width: photo.width, height: photo.height };
      const stampedId = params.stampedId;
      if (stampedId) {
        // editing an existing stamped photo — the stored original is kept
        const stamped = await updateStamped(stampedId, bytes, meta);
        try {
          await saveToGalleryAlbum(stamped.uri);
          toast('Stamped photo updated');
        } catch (e) {
          toast(String(e instanceof Error ? e.message : e), 'error');
        }
        router.replace({ pathname: '/stamped/[id]', params: { id: stampedId } });
      } else {
        const stamped = await saveStamped(bytes, { ...meta, photoUri: photo.uri });
        try {
          await saveToGalleryAlbum(stamped.uri);
          toast(`Saved to the “${ALBUM_NAME}” album in your gallery`);
        } catch (e) {
          toast(String(e instanceof Error ? e.message : e), 'error');
        }
        router.replace({ pathname: '/stamped/[id]', params: { id: stamped.id } });
      }
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!logo || !photo) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.stage}
          onLayout={(e) =>
            setContainer({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          {rect && (
            <View
              style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
            >
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
              <View style={styles.logoAnchor} pointerEvents="none">
                <Animated.Image
                  source={{ uri: logo.uri }}
                  style={[
                    { width: baseLogoW, height: baseLogoW * logoAspect },
                    logoStyle,
                  ]}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}
        </View>
      </GestureDetector>

      <View style={styles.panel}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
        >
          <View style={styles.handleRow}>
            <Text style={[styles.panelHint, { color: theme.textMuted }]}>
              Drag, pinch, and rotate
            </Text>
          </View>
          <Text style={[styles.panelLabel, { color: theme.text }]}>Transparency</Text>
          <Slider
            value={100}
            onChange={(v) => {
              opacity.value = v / 100;
            }}
          />
          <Button
            label={params.stampedId ? 'Update' : 'Save'}
            icon="checkmark"
            onPress={save}
            busy={exporting}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  stage: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden' },
  logoAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
  sheet: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  panelHint: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  panelLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
