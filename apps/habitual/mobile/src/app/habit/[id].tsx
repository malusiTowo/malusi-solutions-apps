import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  BarChart,
  Card,
  Chip,
  Heatmap,
  Muted,
  PrimaryButton,
  SectionHeader,
} from "~/components/ui";

// Skeleton history — a real screen derives this from logged completions.
const CONSISTENCY = Array.from({ length: 105 }, (_, i) => i % 7 !== 5 && i % 4 !== 0);
const DISTANCE = [4.2, 5.1, 3.6, 6.0, 5.4, 2.1, 4.8];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function HabitDetail() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{name ?? "Habit"}</Text>
          <Muted>Daily · 5km goal</Muted>
        </View>
        <Text style={styles.menu}>⋯</Text>
      </View>

      <View style={styles.chips}>
        <Chip value="128" label="current" />
        <Chip value="203" label="best" />
        <Chip value="94%" label="rate" />
      </View>

      <Card>
        <SectionHeader title="Last 15 weeks" trailing="consistency" />
        <Heatmap data={CONSISTENCY} />
        <Muted>Less ▪ ▪ ▪ More</Muted>
      </Card>

      <Card>
        <SectionHeader title="Distance this week" />
        <BarChart values={DISTANCE} labels={DAYS} highlight={3} />
      </Card>

      <View style={styles.spacer} />
      <PrimaryButton label="Log today · +30 XP" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: rt.insets.top + theme.spacing.md,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  back: { color: theme.colors.text, fontSize: theme.fontSize["3xl"] },
  headerText: { flex: 1 },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize["2xl"],
    fontWeight: theme.fontWeight.bold,
  },
  menu: { color: theme.colors.textSecondary, fontSize: theme.fontSize["2xl"] },
  chips: { flexDirection: "row", gap: theme.spacing.md },
  spacer: { height: theme.spacing.lg },
}));
