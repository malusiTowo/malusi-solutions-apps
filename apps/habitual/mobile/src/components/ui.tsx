import type { ReactNode } from "react";
import { Pressable, type PressableProps, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

/** Screen wrapper: safe area + dark background + default padding. */
export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={scroll ? ["top"] : ["top", "bottom"]}>
      <View style={styles.screenInner}>{children}</View>
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.h2}>{title}</Text>
      {trailing ? <Text style={styles.muted}>{trailing}</Text> : null}
    </View>
  );
}

/** Small stat chip (streak / coins / metrics). */
export function Chip({
  value,
  label,
  tone = "surface",
}: {
  value: string;
  label: string;
  tone?: "surface" | "accent";
}) {
  return (
    <View style={[styles.chip, tone === "accent" && styles.chipAccent]}>
      <Text style={[styles.chipValue, tone === "accent" && styles.chipValueAccent]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

/** Circular progress placeholder (no SVG dependency yet). */
export function ProgressRing({ percent, label }: { percent: number; label?: string }) {
  return (
    <View style={styles.ring}>
      <Text style={styles.ringPercent}>{percent}%</Text>
      {label ? <Text style={styles.ringLabel}>{label}</Text> : null}
    </View>
  );
}

export function HabitRow({ name, meta, done }: { name: string; meta: string; done?: boolean }) {
  return (
    <View style={styles.habitRow}>
      <View style={[styles.checkbox, done && styles.checkboxDone]}>
        {done ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <View style={styles.habitRowText}>
        <Text style={styles.habitName}>{name}</Text>
        <Text style={styles.habitMeta}>{meta}</Text>
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  variant = "primary",
  ...props
}: PressableProps & { label: string; variant?: "primary" | "outline" }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === "outline" && styles.buttonOutline,
        pressed && styles.buttonPressed,
      ]}
      {...props}
    >
      <Text style={[styles.buttonLabel, variant === "outline" && styles.buttonLabelOutline]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  h1: {
    color: theme.colors.text,
    fontSize: theme.fontSize["4xl"],
    fontWeight: theme.fontWeight.extrabold,
  },
  h2: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
  },
  muted: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chip: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  chipAccent: {
    backgroundColor: theme.colors.accent,
  },
  chipValue: {
    color: theme.colors.text,
    fontSize: theme.fontSize["2xl"],
    fontWeight: theme.fontWeight.bold,
  },
  chipValueAccent: {
    color: theme.colors.onAccent,
  },
  chipLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: theme.radii.full,
    borderWidth: 14,
    borderColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
  },
  ringPercent: {
    color: theme.colors.text,
    fontSize: theme.fontSize["5xl"],
    fontWeight: theme.fontWeight.bold,
  },
  ringLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkmark: {
    color: theme.colors.onAccent,
    fontWeight: theme.fontWeight.bold,
  },
  habitRowText: {
    flex: 1,
    gap: 2,
  },
  habitName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  habitMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: theme.colors.onAccent,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
  },
  buttonLabelOutline: {
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
}));
