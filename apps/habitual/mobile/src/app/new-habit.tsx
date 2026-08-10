import { useMutation } from "@apollo/client/react";
import { HabitColors } from "@habitual/core/models";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Muted, Pill, PrimaryButton, SettingRow } from "~/components/ui";
import { CreateHabitMutation } from "~/lib/queries";

const COLOR_HEX: Record<(typeof HabitColors)[number], string> = {
  lime: "#C8F135",
  orange: "#F5A623",
  purple: "#8B7CF6",
  blue: "#4FB0F0",
  pink: "#F27CA5",
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SUGGESTIONS = ["Stretch 5 min", "Journal", "No phone after 10pm"];
const REMINDERS = ["7:00 AM", "8:00 AM", "12:00 PM", "6:00 PM", "9:00 PM"];
const GOALS = ["5 minutes", "10 minutes", "20 minutes", "30 minutes", "1 hour"];

/** Cycle helper: returns the next value in a list, wrapping around. */
function next<T>(list: T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length]!;
}

export default function NewHabit() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<(typeof HabitColors)[number]>("lime");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [reminder, setReminder] = useState(REMINDERS[0]!);
  const [goal, setGoal] = useState(GOALS[1]!);

  // Apollo has no `onSettled`, so the close-regardless behaviour is spelled out on
  // both outcomes.
  const [createHabit, create] = useMutation(CreateHabitMutation, {
    onCompleted: () => router.back(),
    onError: () => router.back(),
  });

  const toggleDay = (i: number) =>
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]));

  const onCreate = () => {
    if (!name.trim()) return router.back();
    // Fires against the API when auth is configured; closes regardless (skeleton).
    void createHabit({
      variables: {
        input: {
          name: name.trim(),
          color,
          repeatDays: days,
          reminderAt: reminder,
          dailyGoal: goal,
        },
      },
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>New habit</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.suggestCard}>
        <Text style={styles.suggestTitle}>🟣 Suggested for you</Text>
        <View style={styles.suggestChips}>
          {SUGGESTIONS.map((s) => (
            <Pill key={s} label={s} active={name === s} onPress={() => setName(s)} />
          ))}
        </View>
      </View>

      <Muted>HABIT NAME</Muted>
      <TextInput
        style={styles.input}
        placeholder="Meditate"
        placeholderTextColor="#6B6B70"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Muted>COLOR</Muted>
      <View style={styles.swatches}>
        {HabitColors.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.swatch,
              { backgroundColor: COLOR_HEX[c] },
              color === c && styles.swatchSelected,
            ]}
          />
        ))}
      </View>

      <Muted>REPEAT</Muted>
      <View style={styles.days}>
        {DAYS.map((d, i) => (
          <Pressable
            key={i}
            onPress={() => toggleDay(i)}
            style={[styles.day, days.includes(i) && styles.dayOn]}
          >
            <Text style={[styles.dayLabel, days.includes(i) && styles.dayLabelOn]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.rows}>
        <SettingRow
          label="Reminder"
          value={reminder}
          onPress={() => setReminder((r) => next(REMINDERS, r))}
        />
        <SettingRow
          label="Daily goal"
          value={goal}
          onPress={() => setGoal((g) => next(GOALS, g))}
        />
      </View>

      <View style={styles.spacer} />
      <PrimaryButton
        label={create.loading ? "Creating…" : "Create habit"}
        onPress={onCreate}
        disabled={create.loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: rt.insets.top + theme.spacing.lg,
    paddingBottom: theme.spacing["3xl"],
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize["2xl"],
    fontWeight: theme.fontWeight.bold,
  },
  close: { color: theme.colors.textSecondary, fontSize: theme.fontSize.xl },
  suggestCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  suggestTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  suggestChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
  },
  swatches: { flexDirection: "row", gap: theme.spacing.md },
  swatch: { width: 40, height: 40, borderRadius: theme.radii.full },
  swatchSelected: { borderWidth: 3, borderColor: theme.colors.text },
  days: { flexDirection: "row", gap: theme.spacing.sm },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOn: { backgroundColor: theme.colors.accent },
  dayLabel: { color: theme.colors.textSecondary, fontWeight: theme.fontWeight.semibold },
  dayLabelOn: { color: theme.colors.onAccent },
  rows: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  spacer: { height: theme.spacing.xl },
}));
