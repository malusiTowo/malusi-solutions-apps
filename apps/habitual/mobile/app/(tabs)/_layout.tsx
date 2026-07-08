import { Tabs, useRouter } from "expo-router";
import { type ColorValue, Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 22, color }}>{icon}</Text>;
}

function CenterButton() {
  const router = useRouter();
  return (
    <Pressable style={styles.centerButton} onPress={() => router.push("/new-habit")}>
      <Text style={styles.centerButtonLabel}>+</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#C8F135",
        tabBarInactiveTintColor: "#6B6B70",
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon icon="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => <TabIcon icon="▥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarButton: () => <CenterButton />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: "Rewards",
          tabBarIcon: ({ color }) => <TabIcon icon="♦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon icon="◍" color={color} />,
        }}
      />
      <Tabs.Screen name="coach" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create((theme) => ({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    height: 88,
    paddingTop: theme.spacing.sm,
  },
  centerButton: {
    top: -18,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  centerButtonLabel: {
    color: theme.colors.onAccent,
    fontSize: 32,
    fontWeight: theme.fontWeight.bold,
    marginTop: -2,
  },
}));
