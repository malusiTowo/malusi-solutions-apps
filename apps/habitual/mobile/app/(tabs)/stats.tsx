import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card, Chip, H1, Muted, SectionHeader } from "~/components/ui";

const WEEKS = Array.from({ length: 60 }, (_, i) => i % 4 !== 0);

export default function Stats() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <H1>Insights</H1>

      <View style={styles.chips}>
        <Chip value="128" label="current streak" />
        <Chip value="203" label="best streak" />
        <Chip value="94%" label="completion rate" />
      </View>

      <Card>
        <SectionHeader title="Last 15 weeks" trailing="consistency" />
        <View style={styles.heatmap}>
          {WEEKS.map((on, i) => (
            <View key={i} style={[styles.cell, on ? styles.cellOn : styles.cellOff]} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Completion by day" />
        <View style={styles.bars}>
          {[60, 80, 50, 90, 100, 30, 20].map((h, i) => (
            <View key={i} style={styles.barTrack}>
              <View style={[styles.bar, { height: `${h}%` }]} />
            </View>
          ))}
        </View>
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
  chips: { flexDirection: "row", gap: theme.spacing.md },
  heatmap: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { width: 16, height: 16, borderRadius: 3 },
  cellOn: { backgroundColor: theme.colors.accent },
  cellOff: { backgroundColor: theme.colors.surfaceMuted },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    gap: theme.spacing.sm,
  },
  barTrack: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.sm },
}));
