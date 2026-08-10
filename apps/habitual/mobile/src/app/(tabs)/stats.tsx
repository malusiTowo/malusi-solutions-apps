import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { BarChart, Card, Chip, H1, Heatmap, Muted, SectionHeader } from "~/components/ui";

const WEEKS = Array.from({ length: 60 }, (_, i) => i % 4 !== 0);
const COMPLETION = [60, 80, 50, 90, 100, 30, 20];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Stats() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <H1>Insights</H1>
        <View style={styles.toggle}>
          <Text style={styles.toggleOn}>Week</Text>
          <Text style={styles.toggleOff}>Month</Text>
        </View>
      </View>

      <Card>
        <Muted>Your week, summarized</Muted>
        <Text style={styles.summary}>
          Strong week — 92% completion, up 8%. Mornings are your power window. Watch weekends:
          hydration dips on Saturdays.
        </Text>
      </Card>

      <View style={styles.chips}>
        <Chip value="92%" label="completion · ▲ 8%" />
        <Chip value="31" label="habits done · +620 XP" />
      </View>

      <Card>
        <SectionHeader title="Last 15 weeks" trailing="consistency" />
        <Heatmap data={WEEKS} />
      </Card>

      <Card>
        <SectionHeader title="Completion by day" />
        <BarChart values={COMPLETION} labels={DAYS} highlight={4} />
        <Muted>Mornings are your power window. Weekends dip on hydration.</Muted>
      </Card>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggle: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.full,
    padding: theme.spacing.xs,
  },
  toggleOn: {
    color: theme.colors.onAccent,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    overflow: "hidden",
  },
  toggleOff: {
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
  },
  chips: { flexDirection: "row", gap: theme.spacing.md },
  summary: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
}));
