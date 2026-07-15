import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Slider } from '@/components/slider';
import { useToast } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';
import { markSeen, timesSeen } from '@/lib/hints';
import {
  analyzePhoto,
  encodePhotoAsJpeg,
  renderStampedPhoto,
  type PlacementAnalysis,
} from '@/lib/image-processing';
import { getLogo } from '@/lib/logo-store';
import { saveToGalleryAlbum } from '@/lib/media';
import { decodePhotos, type PickedPhoto } from '@/lib/photo-params';
import { getPlacement, savePlacement, type SavedPlacement } from '@/lib/placement-store';
import { getSettings } from '@/lib/settings';
import { saveStamped, updateStamped } from '@/lib/stamped-store';
import type { Logo } from '@/lib/types';

type Rect = { x: number; y: number; w: number; h: number };

const SELECTION_LIMIT = 20;

/** "contain" fit of the photo inside the available container */
function fitRect(container: { w: number; h: number }, photo: PickedPhoto): Rect {
  const scale = Math.min(container.w / photo.width, container.h / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  return { x: (container.w - w) / 2, y: (container.h - h) / 2, w, h };
}

/**
 * Default logo width as a fraction of the photo's shorter side: 40%, capped
 * so the logo's larger dimension can never exceed 90% of that side.
 */
function baseWidthFrac(logoAspect: number): number {
  return Math.min(0.4, 0.9 / Math.max(1, logoAspect));
}

export default function EditorScreen() {
  const theme = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    logoId: string;
    photos?: string;
    photoUri?: string;
    photoWidth?: string;
    photoHeight?: string;
    stampedId?: string;
    /** JSON array aligned with `photos` — update these instead of creating new */
    stampedIds?: string;
  }>();
  const [logo, setLogo] = useState<Logo | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [container, setContainer] = useState<{ w: number; h: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  // the slider is uncontrolled after mount — bump the key to reposition it
  // when opacity is set programmatically (card switch / remembered placement)
  const [sliderKey, setSliderKey] = useState(0);
  const sliderValue = useRef(100);
  const [placementLoaded, setPlacementLoaded] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [analysis, setAnalysis] = useState<PlacementAnalysis | null>(null);
  const analysisCache = useRef(new Map<string, PlacementAnalysis>());
  /** per-photo placements; null = never visited (falls back to remembered) */
  const placementsRef = useRef<(SavedPlacement | null)[]>([]);
  const rememberedRef = useRef<SavedPlacement | null>(null);
  const initializedRef = useRef(false);

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
  /** horizontal drag of the active card while swiping between photos */
  const deckX = useSharedValue(0);
  /** what the current pan is moving: 1 = the logo, 0 = the deck */
  const panTarget = useSharedValue(1);

  useEffect(() => {
    if (params.logoId) {
      getLogo(params.logoId).then((l) => setLogo(l ?? null));
      getPlacement(params.logoId).then((p) => {
        rememberedRef.current = p ?? null;
        setPlacementLoaded(true);
      });
    }
  }, [params.logoId]);

  useEffect(() => {
    // photos handed over by the previous screen (home / pick-logo / detail)
    const fromParams = decodePhotos(params);
    if (fromParams.length) {
      setPhotos(fromParams);
      return;
    }
    // otherwise ask for them
    (async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: SELECTION_LIMIT,
        orderedSelection: true,
      });
      if (result.canceled) {
        router.back();
        return;
      }
      setPhotos(result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!photos) return;
    const small = photos.filter((p) => Math.max(p.width, p.height) < 800).length;
    if (small === 0) return;
    toast(
      photos.length === 1
        ? 'This photo is quite small — the stamp may look soft'
        : small === 1
          ? 'One of these photos is quite small — its stamp may look soft'
          : `${small} of these photos are quite small — their stamps may look soft`,
      'info',
    );
  }, [photos, toast]);

  let stampedIds: (string | undefined)[] = [];
  if (params.stampedIds) {
    try {
      stampedIds = JSON.parse(params.stampedIds) as string[];
    } catch {
      // treated as a fresh save
    }
  } else if (params.stampedId) {
    stampedIds = [params.stampedId];
  }
  const updating = stampedIds.some(Boolean);

  // one-time swipe coach mark: only the first two batch sessions ever see it
  useEffect(() => {
    if (!photos || photos.length <= 1) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    timesSeen('batch-swipe').then((n) => {
      if (n >= 2) return;
      markSeen('batch-swipe');
      setShowSwipeHint(true);
      timer = setTimeout(() => setShowSwipeHint(false), 5000);
    });
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [photos]);

  // demonstrate the gesture: the top card nudges sideways twice
  useEffect(() => {
    if (!showSwipeHint) return;
    deckX.value = withSequence(
      withDelay(600, withTiming(-26, { duration: 260 })),
      withTiming(0, { duration: 260 }),
      withDelay(250, withTiming(-26, { duration: 260 })),
      withTiming(0, { duration: 260 }),
    );
  }, [showSwipeHint, deckX]);

  const photo = photos?.[index] ?? null;
  const rect = photo && container ? fitRect(container, photo) : null;

  // analyze the active photo for placement suggestions (cached per photo)
  useEffect(() => {
    const uri = photo?.uri;
    if (!uri) return;
    const cached = analysisCache.current.get(uri);
    if (cached) {
      setAnalysis(cached);
      return;
    }
    setAnalysis(null);
    let alive = true;
    analyzePhoto(uri)
      .then((a) => {
        analysisCache.current.set(uri, a);
        if (alive) setAnalysis(a);
      })
      .catch(() => {
        // suggestions just don't appear for this photo
      });
    return () => {
      alive = false;
    };
  }, [photo?.uri]);
  const logoAspect = logo ? logo.height / logo.width : 1;
  const minSide = rect ? Math.min(rect.w, rect.h) : 0;
  const baseFrac = baseWidthFrac(logoAspect);
  const baseLogoW = rect ? baseFrac * minSide : 100;
  const maxScale = 0.9 / (baseFrac * Math.max(1, logoAspect));
  const stageW = container?.w ?? 1;
  const count = photos?.length ?? 0;

  const snapshotPlacement = (r: Rect): SavedPlacement => ({
    cx: (r.w / 2 + tx.value) / r.w,
    cy: (r.h / 2 + ty.value) / r.h,
    widthFrac: baseFrac * scale.value,
    rotation: rotation.value,
    opacity: opacity.value,
  });

  const applyToShared = (p: SavedPlacement | null, r: Rect) => {
    tx.value = p ? p.cx * r.w - r.w / 2 : 0;
    ty.value = p ? p.cy * r.h - r.h / 2 : 0;
    scale.value = p ? Math.min(maxScale, Math.max(0.05, p.widthFrac / baseFrac)) : 1;
    rotation.value = p ? p.rotation : 0;
    opacity.value = p ? p.opacity : 1;
    sliderValue.current = Math.round((p ? p.opacity : 1) * 100);
    setSliderKey((k) => k + 1);
  };

  // silently start from the remembered placement once everything is laid out
  useEffect(() => {
    if (initializedRef.current || !placementLoaded || !logo || !photos?.length || !container)
      return;
    initializedRef.current = true;
    if (rememberedRef.current) {
      applyToShared(rememberedRef.current, fitRect(container, photos[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementLoaded, logo, photos, container]);

  const goTo = (next: number, direction: 'forward' | 'back') => {
    if (!photos || !container) return;
    setShowSwipeHint(false); // they've got it — stop coaching

    placementsRef.current[index] = snapshotPlacement(fitRect(container, photos[index]));
    applyToShared(
      placementsRef.current[next] ?? rememberedRef.current,
      fitRect(container, photos[next]),
    );
    setIndex(next);
    if (direction === 'back') {
      // the previous card flies back onto the pile from where it left
      deckX.value = -container.w;
      deckX.value = withTiming(0, { duration: 200 });
    } else {
      deckX.value = 0;
    }
  };
  const goToNext = () => goTo(index + 1, 'forward');
  const goToPrev = () => goTo(index - 1, 'back');

  const tapNext = () => {
    if (index >= count - 1) return;
    deckX.value = withTiming(-stageW, { duration: 180 }, (finished) => {
      if (finished) runOnJS(goToNext)();
    });
  };
  const tapPrev = () => {
    if (index > 0) goToPrev();
  };

  const animateTo = (p: SavedPlacement) => {
    if (!rect) return;
    const d = 220;
    tx.value = withTiming(p.cx * rect.w - rect.w / 2, { duration: d });
    ty.value = withTiming(p.cy * rect.h - rect.h / 2, { duration: d });
    scale.value = withTiming(
      Math.min(maxScale, Math.max(0.05, p.widthFrac / baseFrac)),
      { duration: d },
    );
    rotation.value = withTiming(p.rotation, { duration: d });
    opacity.value = withTiming(p.opacity, { duration: d });
    sliderValue.current = Math.round(p.opacity * 100);
    setSliderKey((k) => k + 1);
  };

  const suggest = (kind: 'look' | 'protect') => {
    if (!rect || !analysis) return;
    const capFrac = 0.9 / Math.max(1, logoAspect);
    if (kind === 'look') {
      // small and subtle, tucked into the calmest corner
      const wf = Math.min(0.28, capFrac);
      const logoW = wf * minSide;
      const logoH = logoW * logoAspect;
      const m = 0.05 * minSide;
      const cxPx = analysis.quietCorner.x ? rect.w - m - logoW / 2 : m + logoW / 2;
      const cyPx = analysis.quietCorner.y ? rect.h - m - logoH / 2 : m + logoH / 2;
      animateTo({
        cx: cxPx / rect.w,
        cy: cyPx / rect.h,
        widthFrac: wf,
        rotation: 0,
        opacity: 0.85,
      });
    } else {
      // big and translucent, across the subject — removing it means
      // reconstructing the part of the photo that matters
      const wf = Math.min(0.7, capFrac);
      const logoW = wf * minSide;
      const logoH = logoW * logoAspect;
      const cxPx = Math.min(rect.w - logoW / 2, Math.max(logoW / 2, analysis.subject.cx * rect.w));
      const cyPx = Math.min(rect.h - logoH / 2, Math.max(logoH / 2, analysis.subject.cy * rect.h));
      animateTo({
        cx: cxPx / rect.w,
        cy: cyPx / rect.h,
        widthFrac: wf,
        rotation: 0,
        opacity: 0.5,
      });
    }
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      // touch on the logo moves the logo; touch on the background swipes the deck
      if (!rect) {
        panTarget.value = 1;
        return;
      }
      const dx = e.x - (rect.x + rect.w / 2 + tx.value);
      const dy = e.y - (rect.y + rect.h / 2 + ty.value);
      const cos = Math.cos(rotation.value);
      const sin = Math.sin(rotation.value);
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const halfW = (baseLogoW * scale.value) / 2 + 16;
      const halfH = (baseLogoW * logoAspect * scale.value) / 2 + 16;
      panTarget.value = Math.abs(lx) <= halfW && Math.abs(ly) <= halfH ? 1 : 0;
    })
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      if (panTarget.value === 1) {
        tx.value = startX.value + e.translationX;
        ty.value = startY.value + e.translationY;
      } else if (count > 1) {
        const resisted =
          (index === 0 && e.translationX > 0) ||
          (index === count - 1 && e.translationX < 0);
        deckX.value = resisted ? e.translationX * 0.25 : e.translationX;
      }
    })
    .onEnd((e) => {
      if (panTarget.value === 1 || count <= 1) return;
      const threshold = stageW * 0.25;
      const fling = Math.abs(e.velocityX) > 800;
      if ((e.translationX < -threshold || (fling && e.velocityX < 0)) && index < count - 1) {
        deckX.value = withTiming(-stageW, { duration: 180 }, (finished) => {
          if (finished) runOnJS(goToNext)();
        });
      } else if ((e.translationX > threshold || (fling && e.velocityX > 0)) && index > 0) {
        runOnJS(goToPrev)();
      } else {
        deckX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(maxScale, Math.max(0.05, startScale.value * e.scale));
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

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: deckX.value },
      { rotateZ: `${(deckX.value / stageW) * -5}deg` },
    ],
  }));

  const defaultPlacement = (): SavedPlacement => ({
    cx: 0.5,
    cy: 0.5,
    widthFrac: baseFrac,
    rotation: 0,
    opacity: 1,
  });

  /** Export placement in the photo's own pixels (displayWidth = native width). */
  const displayPlacement = (p: SavedPlacement, ph: PickedPhoto) => ({
    displayWidth: ph.width,
    centerX: p.cx * ph.width,
    centerY: p.cy * ph.height,
    logoDisplayWidth:
      Math.min(p.widthFrac, 0.9 / Math.max(1, logoAspect)) *
      Math.min(ph.width, ph.height),
    rotation: p.rotation,
    opacity: p.opacity,
  });

  const rememberPlacement = (p: SavedPlacement) => {
    if (!logo) return;
    savePlacement(logo.id, p).catch(() => {});
    rememberedRef.current = p;
  };

  const save = async () => {
    if (!photos?.length || !rect || !container) return;
    setExporting(true);
    try {
      placementsRef.current[index] = snapshotPlacement(rect);

      const backup = (await getSettings()).phoneGalleryBackup;
      const savedIds: string[] = [];
      let galleryError: string | null = null;
      for (let i = 0; i < photos.length; i++) {
        if (photos.length > 1) setProgress(`Stamping ${i + 1} of ${photos.length}…`);
        const ph = photos[i];
        const p = placementsRef.current[i] ?? rememberedRef.current ?? defaultPlacement();
        const bytes = logo
          ? await renderStampedPhoto(ph.uri, logo.uri, displayPlacement(p, ph))
          : await encodePhotoAsJpeg(ph.uri);
        const sid = stampedIds[i];
        const stamped = sid
          ? // editing an existing stamped photo — the stored original is kept
            await updateStamped(sid, bytes, { width: ph.width, height: ph.height })
          : await saveStamped(bytes, {
              width: ph.width,
              height: ph.height,
              photoUri: ph.uri,
            });
        if (backup) {
          try {
            await saveToGalleryAlbum(stamped.uri);
          } catch (e) {
            galleryError = String(e instanceof Error ? e.message : e);
          }
        }
        savedIds.push(stamped.id);
      }
      if (logo) rememberPlacement(placementsRef.current[index] ?? defaultPlacement());
      if (galleryError) {
        toast(galleryError, 'error');
      } else if (updating) {
        toast(photos.length > 1 ? `${photos.length} photos updated` : 'Stamped photo updated');
      } else if ((await timesSeen('gallery-home')) === 0) {
        // first save ever: explain where photos live, once
        markSeen('gallery-home');
        toast(
          backup
            ? 'Saved. Photos live in Markly’s Gallery — a backup also goes to your phone gallery (see Settings)'
            : 'Saved. Photos live in Markly’s Gallery',
          'info',
        );
      } else {
        toast(
          photos.length > 1
            ? `${photos.length} photos saved to your Gallery`
            : 'Saved to your Gallery',
        );
      }
      if (photos.length > 1) {
        router.replace('/stamped');
      } else {
        router.replace({ pathname: '/stamped/[id]', params: { id: savedIds[0] } });
      }
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  if (!logo || !photos) {
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
          {container &&
            photos
              .slice(index + 1, index + 3)
              .map((ph, k) => {
                const r = fitRect(container, ph);
                const depth = k + 1;
                return (
                  <View
                    key={`${ph.uri}-${index + 1 + k}`}
                    style={[
                      styles.card,
                      styles.pileCard,
                      {
                        left: r.x,
                        top: r.y,
                        width: r.w,
                        height: r.h,
                        transform: [
                          { scale: 1 - 0.05 * depth },
                          { translateY: 10 * depth },
                          { rotateZ: `${depth % 2 ? -2.5 : 2}deg` },
                        ],
                      },
                    ]}
                  >
                    <Image source={{ uri: ph.uri }} style={StyleSheet.absoluteFill} />
                    {/* cloud the pile out so the active photo keeps the focus */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: theme.background, opacity: 0.72 },
                      ]}
                    />
                  </View>
                );
              })
              .reverse()}
          {rect && photo && (
            <Animated.View
              style={[
                styles.card,
                styles.activeCard,
                { left: rect.x, top: rect.y, width: rect.w, height: rect.h },
                cardStyle,
              ]}
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
            </Animated.View>
          )}
          {count > 1 && (
            <View style={styles.counterWrap} pointerEvents="box-none">
              <View style={[styles.counter, { backgroundColor: theme.surface }]}>
                <Pressable
                  onPress={tapPrev}
                  disabled={index === 0}
                  hitSlop={8}
                  style={{ opacity: index === 0 ? 0.25 : 1 }}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.accent} />
                </Pressable>
                <Text style={[styles.counterText, { color: theme.textMuted }]}>
                  {index + 1} of {count}
                </Text>
                <Pressable
                  onPress={tapNext}
                  disabled={index === count - 1}
                  hitSlop={8}
                  style={{ opacity: index === count - 1 ? 0.25 : 1 }}
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                </Pressable>
              </View>
            </View>
          )}
          {showSwipeHint && rect && (
            <Animated.View
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(250)}
              style={styles.hintWrap}
              pointerEvents="none"
            >
              <View style={[styles.hintPill, { backgroundColor: theme.surface }]}>
                <Ionicons name="swap-horizontal" size={16} color={theme.accent} />
                <Text style={[styles.hintText, { color: theme.text }]}>
                  Swipe to check each photo
                </Text>
              </View>
            </Animated.View>
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
              {progress ??
                (count > 1
                  ? 'Drag the logo • swipe the photo to check each one'
                  : 'Drag, pinch, and rotate')}
            </Text>
          </View>
          {analysis && rect && (
            <View style={styles.chipRow}>
              <SuggestChip
                icon="sparkles-outline"
                label="Best look"
                onPress={() => suggest('look')}
              />
              <SuggestChip
                icon="shield-outline"
                label="Best protection"
                onPress={() => suggest('protect')}
              />
            </View>
          )}
          <Text style={[styles.panelLabel, { color: theme.text }]}>Transparency</Text>
          <Slider
            key={sliderKey}
            value={sliderValue.current}
            onChange={(v) => {
              opacity.value = v / 100;
              sliderValue.current = Math.round(v);
            }}
          />
          <Button
            label={
              updating
                ? count > 1
                  ? `Update ${count} photos`
                  : 'Update'
                : count > 1
                  ? `Save ${count} photos`
                  : 'Save'
            }
            icon="checkmark"
            onPress={save}
            busy={exporting}
          />
        </View>
      </View>
    </View>
  );
}

function SuggestChip({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.accentSoft },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Ionicons name={icon} size={14} color={theme.accent} />
      <Text style={[styles.chipLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  stage: { flex: 1, margin: 12 },
  card: {
    position: 'absolute',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeCard: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pileCard: { opacity: 0.85 },
  counterWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  counterText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  hintWrap: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  hintText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  logoAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // sits below the stage in normal flow so the sheet never covers the photo
  panel: {
    paddingHorizontal: 12,
    paddingBottom: 12,
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
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  chipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
