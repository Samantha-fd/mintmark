import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type ActionBarItem = {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  /** accent = the screen's main action; danger = destructive */
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
};

/** Gallery-style bottom bar: a row of small icon actions with tiny labels. */
export function ActionBar({ items }: { items: ActionBarItem[] }) {
  const theme = useTheme();
  const colorFor = (tone: ActionBarItem['tone']) =>
    tone === 'accent' ? theme.accent : tone === 'danger' ? theme.danger : theme.textMuted;
  return (
    <View style={[styles.bar, { backgroundColor: theme.surface }]}>
      {items.map((item) => {
        const color = colorFor(item.tone);
        return (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            disabled={item.disabled}
            hitSlop={8}
            style={({ pressed }) => [
              styles.item,
              (pressed || item.disabled) && { opacity: 0.5 },
            ]}
          >
            <Ionicons name={item.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  item: { alignItems: 'center', gap: 3, minWidth: 56 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
