import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from '@expo-google-fonts/inter';
import { Image as ExpoImage } from 'expo-image';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OnboardingGate } from '@/components/onboarding';
import { PermissionGate } from '@/components/permission-gate';
import { ToastProvider } from '@/components/toast';
import { useTheme } from '@/hooks/use-theme';

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ExpoImage
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: 120, height: 120 }}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <OnboardingGate>
        <PermissionGate>
          <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ title: 'New Logo' }} />
          <Stack.Screen name="create-text" options={{ title: 'Text Watermark' }} />
          <Stack.Screen name="pick-logo" options={{ title: 'Choose a Mark' }} />
          <Stack.Screen name="editor" options={{ title: 'Add logo to photo' }} />
          <Stack.Screen name="logo/[id]" options={{ title: 'Logo' }} />
          <Stack.Screen name="stamped/[id]" options={{ title: 'Logo Photo' }} />
          <Stack.Screen
            name="recently-deleted"
            options={{ title: 'Recently deleted' }}
          />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </PermissionGate>
        </OnboardingGate>
        <StatusBar style="auto" />
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
