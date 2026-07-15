import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type ToastType = 'success' | 'error' | 'info';
type ToastAction = { label: string; onPress: () => void };
type ToastState = { id: number; message: string; type: ToastType; action?: ToastAction };

const ToastContext = createContext<
  (message: string, type?: ToastType, action?: ToastAction) => void
>(() => {});

/** `const toast = useToast(); toast('Saved!');` */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction) => {
      setToast({ id: Date.now(), message, type, action });
      if (timer.current) clearTimeout(timer.current);
      // leave time to actually press the action button
      timer.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
    },
    [],
  );

  const accentColor = toast?.type === 'error' ? theme.danger : theme.accent;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(250)}
          pointerEvents={toast.action ? 'box-none' : 'none'}
          style={[
            styles.toast,
            {
              backgroundColor: theme.surface,
              bottom: 24 + insets.bottom,
              borderLeftColor: accentColor,
            },
          ]}
        >
          <Ionicons
            name={
              toast.type === 'error'
                ? 'alert-circle'
                : toast.type === 'info'
                  ? 'information-circle'
                  : 'checkmark-circle'
            }
            size={18}
            color={accentColor}
          />
          <Text style={[styles.message, { color: theme.text }]} numberOfLines={2}>
            {toast.message}
          </Text>
          {toast.action && (
            <Pressable
              onPress={() => {
                if (timer.current) clearTimeout(timer.current);
                setToast(null);
                toast.action?.onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: theme.accentSoft },
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={[styles.actionLabel, { color: theme.accent }]}>
                {toast.action.label}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  message: { fontFamily: 'Inter_500Medium', fontSize: 13, flexShrink: 1 },
  action: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  actionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
