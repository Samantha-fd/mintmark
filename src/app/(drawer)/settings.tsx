import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { getSettings, setSetting } from '@/lib/settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [backup, setBackup] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setBackup(s.phoneGalleryBackup);
      setLoaded(true);
    });
  }, []);

  const toggleBackup = (value: boolean) => {
    setBackup(value);
    setSetting('phoneGalleryBackup', value);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
    >
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Storage</Text>
      <View style={[styles.panel, { backgroundColor: theme.surface }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.label, { color: theme.text }]}>
              Back up to phone gallery
            </Text>
            <Text style={[styles.sublabel, { color: theme.textMuted }]}>
              Every stamped photo also gets saved to the “Mintmark” album in your
              phone gallery.
            </Text>
          </View>
          <Switch
            value={backup}
            onValueChange={toggleBackup}
            disabled={!loaded}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.surface}
          />
        </View>
        <Text style={[styles.note, { color: theme.textMuted }]}>
          Your photos always live in Mintmark’s Gallery either way. Turning the
          backup off keeps just one copy and saves storage space.
        </Text>
        {!backup && (
          <Text style={[styles.warning, { color: theme.danger }]}>
            Heads up: with backup off, photos exist only inside Mintmark — if you
            ever uninstall the app, they’re gone with it.
          </Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 16 }]}>
        Help
      </Text>
      <Pressable
        onPress={() => router.push('/onboarding')}
        style={({ pressed }) => [
          styles.panel,
          styles.linkRow,
          { backgroundColor: theme.surface },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Ionicons name="play-circle-outline" size={22} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.text }]}>
            Watch the intro again
          </Text>
          <Text style={[styles.sublabel, { color: theme.textMuted }]}>
            The short tour of marks, stamping, and backups
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panel: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  sublabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  warning: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
});
