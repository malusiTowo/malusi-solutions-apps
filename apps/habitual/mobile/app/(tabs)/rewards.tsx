import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card, H1, HabitRow, Muted, SectionHeader } from "~/components/ui";

const ACHIEVEMENTS = [
  { icon: "🟠", label: "100 days" },
  { icon: "⭐", label: "Early bird" },
  { icon: "🔷", label: "Focused" },
  { icon: "🔒", label: "Locked" },
];

export default function Rewards() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <H1>Rewards</H1>
        <View style={styles.coins}>
          <Text style={styles.coinsText}>340 🪙</Text>
        </View>
      </View>

      <Card>
        <SectionHeader title="Level 7 · Achiever" trailing="260 XP left" />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "78%" }]} />
        </View>
      </Card>

      <SectionHeader title="Achievements" trailing="14 / 40" />
      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => (
          <View key={a.label} style={styles.badge}>
            <Text style={styles.badgeIcon}>{a.icon}</Text>
            <Muted>{a.label}</Muted>
          </View>
        ))}
      </View>

      <SectionHeader title="Spend coins" />
      <View style={styles.spend}>
        <HabitRow name="Streak freeze" meta="Protect a missed day · 120 🪙" />
        <HabitRow name="Midnight theme" meta="Unlock a new look · 250 🪙" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing["3xl"],
    paddingBottom: theme.spacing["4xl"],
    gap: theme.spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coins: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  coinsText: { color: theme.colors.orange, fontWeight: theme.fontWeight.semibold },
  progressTrack: {
    height: 10,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.colors.accent },
  grid: { flexDirection: "row", gap: theme.spacing.md },
  badge: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.lg,
  },
  badgeIcon: { fontSize: 26 },
  spend: { gap: theme.spacing.sm },
}));
