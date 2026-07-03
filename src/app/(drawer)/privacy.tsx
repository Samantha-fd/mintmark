import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

const UPDATED = '3 July 2026';

export default function PrivacyPolicyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const Section = ({ title, children }: { title: string; children: string }) => (
    <>
      <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{children}</Text>
    </>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
    >
      <Text style={[styles.updated, { color: theme.textMuted }]}>
        Last updated: {UPDATED}
      </Text>

      <Section title="The short version">
        Markly does not collect, store, or share any of your personal data.
        Everything the app does happens entirely on your phone.
      </Section>

      <Section title="Your photos and logos">
        Markly asks for photo access so you can pick pictures to turn into
        logos and to stamp your logos onto photos. Logos and stamped photos
        you save are stored only on your device, inside the app and in your
        gallery. They are never uploaded anywhere — Markly has no servers and
        makes no internet connections with your images.
      </Section>

      <Section title="Sharing">
        When you use the Share button, your photo is handed to the app you
        choose (for example WhatsApp or Instagram). From that point the
        receiving app's own privacy policy applies.
      </Section>

      <Section title="Accounts and tracking">
        Markly has no user accounts, no sign-in, no advertising, and no
        analytics or tracking of any kind.
      </Section>

      <Section title="Deleting your data">
        All of Markly's data lives on your device. Deleting a logo or stamped
        photo inside the app removes it permanently, and uninstalling the app
        removes everything the app stored. Photos you saved to your gallery
        remain in your gallery until you delete them there.
      </Section>

      <Section title="Children">
        Markly does not knowingly collect any information from anyone,
        including children — because it collects no information at all.
      </Section>

      <Section title="Changes and contact">
        If this policy ever changes, the updated version will appear on this
        page with a new date. Questions are welcome at samymasara@gmail.com.
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  updated: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 16 },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
});
