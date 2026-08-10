import { useQuery } from "@apollo/client/react";
import { palette } from "@repo/design/tokens";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card, Chip, H1, HabitRow, MultiRing, Muted, SectionHeader } from "~/components/ui";
import { registerForPushNotificationsAsync } from "~/lib/notifications";
import { HealthQuery } from "~/lib/queries";

const WEEK = [
  { day: "M", done: true },
  { day: "T", done: true },
  { day: "W", done: true },
  { day: "T", done: true },
  { day: "F", done: false },
  { day: "S", done: false },
  { day: "S", done: false },
];

const GOALS = [
  { label: "Health", percent: 82, color: palette.accent },
  { label: "Focus", percent: 64, color: palette.orange },
  { label: "Mind", percent: 40, color: palette.purple },
];

const HABITS = [
  {
    id: "morning-run",
    name: "Morning run · 5km",
    meta: "+30 XP earned",
    done: true,
    color: palette.accent,
  },
  { id: "read", name: "Read 10 pages", meta: "Evening · +20 XP", done: false, color: palette.blue },
  {
    id: "water",
    name: "Drink 2L water",
    meta: "1.2L logged · +15 XP",
    done: false,
    color: palette.blue,
  },
];

export default function Home() {
  const router = useRouter();
  // Apollo does not retry by default (that is `RetryLink`, opt-in), so the old
  // `retry: false` needs no equivalent. `errorPolicy: "all"` keeps `data` alongside
  // errors, which is what a status indicator on an unconfigured box wants.
  const health = useQuery(HealthQuery, { errorPolicy: "all" });

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

      <View>
        <View style={styles.xpLabels}>
          <Muted>1,240 XP</Muted>
          <Muted>260 to Lvl 8</Muted>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: "78%" }]} />
        </View>
      </View>

      <View style={styles.chips}>
        <Chip value="128 🔥" label="day streak · personal best" />
        <Chip value="340 🪙" label="coins" tone="accent" />
      </View>

      <Card>
        <View style={styles.goalsRow}>
          <MultiRing size={132} rings={GOALS}>
            <Text style={styles.goalsPercent}>72%</Text>
            <Text style={styles.goalsCaption}>daily goals</Text>
          </MultiRing>
          <View style={styles.legend}>
            {GOALS.map((g) => (
              <View key={g.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: g.color }]} />
                <Text style={styles.legendLabel}>{g.label}</Text>
                <Text style={styles.legendValue}>{g.percent}%</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <View style={styles.week}>
        {WEEK.map((d, i) => (
          <View key={i} style={styles.weekItem}>
            <Text style={styles.weekDay}>{d.day}</Text>
            <View style={[styles.weekDot, d.done && styles.weekDotOn]}>
              {d.done ? <Text style={styles.weekCheck}>✓</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <SectionHeader title="Today" trailing="3 of 5 done" />
      <View style={styles.habits}>
        {HABITS.map((h) => (
          <HabitRow
            key={h.id}
            name={h.name}
            meta={h.meta}
            done={h.done}
            color={h.color}
            onPress={() => router.push(`/habit/${h.id}?name=${encodeURIComponent(h.name)}`)}
          />
        ))}
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
        API: {health.loading ? "checking…" : health.data?.health.ok ? "connected ✓" : "offline"}
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
  xpLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  xpTrack: {
    height: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
  },
  chips: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  goalsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xl,
  },
  goalsPercent: {
    color: theme.colors.text,
    fontSize: theme.fontSize["3xl"],
    fontWeight: theme.fontWeight.bold,
  },
  goalsCaption: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  legend: {
    flex: 1,
    gap: theme.spacing.md,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radii.full,
  },
  legendLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  legendValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  week: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekItem: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  weekDay: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotOn: {
    backgroundColor: theme.colors.accent,
  },
  weekCheck: {
    color: theme.colors.onAccent,
    fontWeight: theme.fontWeight.bold,
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
