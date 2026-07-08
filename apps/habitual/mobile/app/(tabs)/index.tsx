import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card, Chip, H1, HabitRow, Muted, SectionHeader } from "~/components/ui";
import { trpc } from "~/lib/api";
import { registerForPushNotificationsAsync } from "~/lib/notifications";

export default function Home() {
  const router = useRouter();
  const health = trpc.health.useQuery(undefined, { retry: false });

  useEffect(() => {
    // Prompt for notification permission on first Home render (skeleton).
    void registerForPushNotificationsAsync();
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Muted>Good morning</Muted>
          <H1>Alex</H1>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lvl 7 · Achiever</Text>
        </View>
      </View>

      <View style={styles.chips}>
        <Chip value="128 🔥" label="day streak · personal best" />
        <Chip value="340 🪙" label="coins" tone="accent" />
      </View>

      <SectionHeader title="Today" trailing="3 of 5 done" />
      <View style={styles.habits}>
        <HabitRow name="Morning run · 5km" meta="+30 XP earned" done />
        <HabitRow name="Read 10 pages" meta="Evening · +20 XP" />
        <HabitRow name="Drink 2L water" meta="1.2L logged · +15 XP" />
      </View>

      <Pressable onPress={() => router.push("/(tabs)/coach")}>
        <Card>
          <Text style={styles.coachTitle}>🟣 AI Coach</Text>
          <Muted>
            You usually skip water in the afternoon. Want a 3pm reminder? Tap to chat with your
            coach.
          </Muted>
        </Card>
      </Pressable>

      <Muted>
        API: {health.isLoading ? "checking…" : health.data?.ok ? "connected ✓" : "offline"}
      </Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing["3xl"],
    paddingBottom: theme.spacing["4xl"],
    gap: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  levelBadge: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  levelText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  chips: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  habits: {
    gap: theme.spacing.sm,
  },
  coachTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
}));
