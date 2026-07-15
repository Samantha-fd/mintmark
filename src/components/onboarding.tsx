import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';
import { markSeen, timesSeen } from '@/lib/hints';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/** where the user chose to go from the final step */
export type OnboardingTarget = 'create' | 'create-text' | null;

function StepRow({ icon, title, sub }: { icon: IoniconsName; title: string; sub: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: theme.textMuted }]}>{sub}</Text>
      </View>
    </View>
  );
}

export function Onboarding({ onDone }: { onDone: (target: OnboardingTarget) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const askPhotos = async () => {
    try {
      // only photos — the default also asks for audio, which is not declared
      // in the manifest and gets rejected
      await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    } catch {
      // Expo Go on Android has no media library — the gate stays lenient there
    }
    setStep(3);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: 24 + insets.top,
          paddingBottom: 20 + insets.bottom,
        },
      ]}
    >
      {step === 0 && (
        <>
          <View style={styles.body}>
            <ExpoImage
              source={require('@/assets/images/splash-icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>
              Put your mark on every photo
            </Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              Your logo or name, stamped onto your pictures in seconds.
            </Text>
            <View style={styles.badges}>
              {['no account', 'no upload', 'free'].map((b) => (
                <View key={b} style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[styles.badgeLabel, { color: theme.accent }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
          <Button label="Get started" icon="arrow-forward" onPress={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <View style={[styles.body, { gap: 22 }]}>
            <StepRow
              icon="color-wand-outline"
              title="Make your mark"
              sub="From any picture — or just your name as text"
            />
            <StepRow
              icon="images-outline"
              title="Stamp your photos"
              sub="One at a time, or a whole batch at once"
            />
            <StepRow
              icon="share-social-outline"
              title="Share everywhere"
              sub="Every share carries your brand with it"
            />
          </View>
          <Button label="Next" icon="arrow-forward" onPress={() => setStep(2)} />
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.body}>
            <View style={[styles.bigIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="images-outline" size={30} color={theme.accent} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              Markly works with your photos
            </Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              Pick pictures, stamp them, save them back. Nothing ever leaves
              your phone — Markly has no servers.
            </Text>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={13} color={theme.accent} />
              <Text style={[styles.lockLabel, { color: theme.accent }]}>
                100% on-device
              </Text>
            </View>
            <Text style={[styles.footnote, { color: theme.textMuted }]}>
              Stamped photos are also backed up to your phone gallery — you can
              change that in Settings. Photos kept only in Markly are lost if
              the app is ever uninstalled.
            </Text>
          </View>
          <Button label="Allow photo access" icon="checkmark" onPress={askPhotos} />
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.text }]}>
              Create your first mark
            </Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              Takes about 30 seconds.
            </Text>
            <View style={styles.choiceList}>
              <Pressable
                onPress={() => onDone('create')}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: theme.accent, borderWidth: 1.5 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="image-outline" size={22} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>
                    From a picture
                  </Text>
                  <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                    We make the background transparent
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onDone('create-text')}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: theme.border, borderWidth: 1 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="text-outline" size={22} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>From text</Text>
                  <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                    Your name or @handle
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
          <Pressable onPress={() => onDone(null)} hitSlop={8}>
            <Text style={[styles.skip, { color: theme.textMuted }]}>
              I’ll look around first
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/**
 * Shows the intro flow exactly once, before anything else. The permission
 * gate stays downstream for the revoked-permission case.
 */
export function OnboardingGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<'checking' | 'show' | 'done'>('checking');
  const [target, setTarget] = useState<OnboardingTarget>(null);

  useEffect(() => {
    timesSeen('onboarding').then((n) => setState(n > 0 ? 'done' : 'show'));
  }, []);

  // navigate to the chosen first action once the app tree is mounted
  useEffect(() => {
    if (state !== 'done' || !target) return;
    const timer = setTimeout(() => {
      router.push(target === 'create' ? '/create' : '/create-text');
    }, 100);
    return () => clearTimeout(timer);
  }, [state, target]);

  if (state === 'checking') return null;
  if (state === 'show') {
    return (
      <Onboarding
        onDone={(t) => {
          markSeen('onboarding');
          setTarget(t);
          setState('done');
        }}
      />
    );
  }
  return children;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: 12 },
  logo: { width: 88, height: 88, alignSelf: 'center', marginBottom: 8 },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  badge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14 },
  badgeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 1 },
  bigIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  lockLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  footnote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  choiceList: { gap: 10, marginTop: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 16,
  },
  skip: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
