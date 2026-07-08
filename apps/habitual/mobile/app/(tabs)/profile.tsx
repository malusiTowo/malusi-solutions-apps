import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Card, H1, Muted, PrimaryButton, Screen } from "~/components/ui";
import { clerkConfigured } from "~/lib/auth";

export default function Profile() {
  const router = useRouter();
  return (
    <Screen>
      <H1>Profile</H1>
      <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View>
            <Text style={styles.name}>Alex</Text>
            <Muted>Level 7 · Achiever · 1,240 XP</Muted>
          </View>
        </View>
      </Card>

      <Card>
        <Muted>
          Auth is {clerkConfigured ? "configured with Clerk" : "not configured — add Clerk keys"}.
          Sign-in / sign-up flows plug in here.
        </Muted>
      </Card>

      <View style={styles.spacer} />
      <PrimaryButton
        label="Back to onboarding"
        variant="outline"
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  avatarRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.onAccent,
    fontSize: theme.fontSize["2xl"],
    fontWeight: theme.fontWeight.bold,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
  },
  spacer: { flex: 1 },
}));
