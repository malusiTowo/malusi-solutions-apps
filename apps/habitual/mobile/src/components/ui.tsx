import { palette } from "@repo/design/tokens";
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

/**
 * Arc ring drawn from tangential segments (no SVG dependency). Each segment is
 * rotated around the centre and pushed out to the track radius; the first
 * `percent` share is filled with `color`, the rest with `track`.
 */
function RingArc({
  size,
  thickness,
  percent,
  color,
  track,
  segments = 60,
}: {
  size: number;
  thickness: number;
  percent: number;
  color: string;
  track: string;
  segments?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * segments);
  const radius = size / 2 - thickness / 2;
  const segHeight = thickness;
  const segWidth = (2 * Math.PI * radius) / segments + 1.5;
  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: segments }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: size / 2 - segWidth / 2,
            top: size / 2 - segHeight / 2,
            width: segWidth,
            height: segHeight,
            borderRadius: 2,
            backgroundColor: i < filled ? color : track,
            transform: [{ rotate: `${(i / segments) * 360}deg` }, { translateY: -radius }],
          }}
        />
      ))}
    </View>
  );
}

/** Single progress ring with a centred percentage (or custom children). */
export function ProgressRing({
  percent,
  label,
  size = 200,
  thickness = 14,
  color = palette.accent,
  children,
}: {
  percent: number;
  label?: string;
  size?: number;
  thickness?: number;
  color?: string;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <RingArc
        size={size}
        thickness={thickness}
        percent={percent}
        color={color}
        track={palette.surfaceMuted}
      />
      <View style={styles.ringCenter}>
        {children ?? (
          <>
            <Text style={styles.ringPercent}>{percent}%</Text>
            {label ? <Text style={styles.ringLabel}>{label}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

/** Concentric activity rings (e.g. daily goals by category). */
export function MultiRing({
  rings,
  size = 150,
  children,
}: {
  rings: { percent: number; color: string }[];
  size?: number;
  children?: ReactNode;
}) {
  const thickness = 12;
  const gap = 5;
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      {rings.map((r, i) => {
        const ringSize = size - i * (thickness + gap) * 2;
        return (
          <View key={i} style={styles.ringCenter}>
            <RingArc
              size={ringSize}
              thickness={thickness}
              percent={r.percent}
              color={r.color}
              track={palette.surfaceMuted}
              segments={54}
            />
          </View>
        );
      })}
      {children ? <View style={styles.ringCenter}>{children}</View> : null}
    </View>
  );
}

/** Consistency grid (wraps into rows). `data[i]` true = completed. */
export function Heatmap({ data }: { data: boolean[] }) {
  return (
    <View style={styles.heatmap}>
      {data.map((on, i) => (
        <View key={i} style={[styles.heatCell, on ? styles.heatOn : styles.heatOff]} />
      ))}
    </View>
  );
}

/** Vertical bar chart with optional day labels and a highlighted bar. */
export function BarChart({
  values,
  labels,
  highlight,
}: {
  values: number[];
  labels?: string[];
  highlight?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.chart}>
      <View style={styles.bars}>
        {values.map((v, i) => (
          <View key={i} style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { height: `${(v / max) * 100}%` },
                highlight !== undefined && highlight !== i && styles.barMuted,
              ]}
            />
          </View>
        ))}
      </View>
      {labels ? (
        <View style={styles.barLabels}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.barLabel}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Tappable settings row: label on the left, value + chevron on the right. */
export function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>
        <Text style={styles.settingValue}>{value}</Text>
        <Text style={styles.settingChevron}>›</Text>
      </View>
    </Pressable>
  );
}

/** Rounded suggestion pill. */
export function Pill({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function HabitRow({
  name,
  meta,
  done,
  color,
  onPress,
}: {
  name: string;
  meta: string;
  done?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.habitRow} onPress={onPress} disabled={!onPress}>
      <View
        style={[
          styles.checkbox,
          done && styles.checkboxDone,
          done && color ? { backgroundColor: color, borderColor: color } : null,
        ]}
      >
        {done ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <View style={styles.habitRowText}>
        <Text style={styles.habitName}>{name}</Text>
        <Text style={styles.habitMeta}>{meta}</Text>
      </View>
      {onPress ? <Text style={styles.settingChevron}>›</Text> : null}
    </Pressable>
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
  ringWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
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
  heatmap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  heatCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  heatOn: {
    backgroundColor: theme.colors.accent,
  },
  heatOff: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  chart: {
    gap: theme.spacing.sm,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    gap: theme.spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  bar: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.sm,
  },
  barMuted: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabel: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  settingValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
  },
  settingChevron: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xl,
  },
  pill: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
  },
  pillLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  pillLabelActive: {
    color: theme.colors.onAccent,
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
