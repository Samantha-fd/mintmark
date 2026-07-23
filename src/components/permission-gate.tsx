import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useTheme } from '@/hooks/use-theme';

type GateState = 'checking' | 'blocked' | 'ready';

/**
 * Blocks the whole app until photo access is granted. Shown on first launch
 * (and again if the user later revokes the permission in settings).
 */
export function PermissionGate({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GateState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);

  const check = useCallback(async () => {
    try {
      // photos only — the default also asks for audio/video, which are not
      // declared in the manifest (video stamping is shelved) and get rejected
      const p = await MediaLibrary.getPermissionsAsync(false, ['photo']);
      setCanAskAgain(p.canAskAgain);
      setState(p.granted ? 'ready' : 'blocked');
    } catch {
      // Expo Go on Android cannot use the media library at all — skip the
      // gate there so the app stays testable. Installed builds enforce it.
      setState('ready');
    }
  }, []);

  useEffect(() => {
    check();
    // re-check when returning from the system settings screen
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const request = async () => {
    try {
      const p = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      setCanAskAgain(p.canAskAgain);
      setState(p.granted ? 'ready' : 'blocked');
    } catch {
      setState('ready');
    }
  };

  if (state === 'ready') return children;

  if (state === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.center,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: 24 + insets.bottom,
        },
      ]}
    >
      <ExpoImage
        source={require('@/assets/images/splash-icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={[styles.title, { color: theme.text }]}>
        Photos are needed to add your logos
      </Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>
        Choose photos and logos from your gallery, then save your photos with
        logos back. Your pictures never leave your phone.
      </Text>
      <View style={styles.actions}>
        {canAskAgain ? (
          <Button label="Allow photo access" onPress={request} />
        ) : (
          <>
            <Text style={[styles.settingsHint, { color: theme.textMuted }]}>
              Please enable “Photos and videos” in settings.
            </Text>
            <Button
              label="Open settings"
              icon="settings-outline"
              onPress={() => Linking.openSettings()}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: { alignSelf: 'stretch', marginTop: 28, gap: 12 },
  settingsHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
