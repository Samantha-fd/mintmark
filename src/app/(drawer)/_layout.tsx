import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';

import { useTheme } from '@/hooks/use-theme';

export default function DrawerLayout() {
  const theme = useTheme();
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.background },
        drawerStyle: { backgroundColor: theme.background },
        drawerActiveTintColor: theme.accent,
        drawerActiveBackgroundColor: theme.accentSoft,
        drawerInactiveTintColor: theme.textMuted,
        drawerLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Markly',
          drawerLabel: 'Home',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="logos"
        options={{
          title: 'My Logos',
          drawerLabel: 'My Logos',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="stamped"
        options={{
          title: 'Logo Photos',
          drawerLabel: 'Logo Photos',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
