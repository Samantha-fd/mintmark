import { router, Stack } from 'expo-router';

import { Onboarding } from '@/components/onboarding';

/** Replayable intro, reachable from Settings → "Watch the intro again". */
export default function OnboardingReplayScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Onboarding
        onDone={(target) => {
          if (target === 'create') router.replace('/create');
          else if (target === 'create-text') router.replace('/create-text');
          else router.back();
        }}
      />
    </>
  );
}
