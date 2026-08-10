import { useRouter } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { H1, Muted, PrimaryButton, ProgressRing, Screen } from "~/components/ui";

export default function Onboarding() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.top}>
        <ProgressRing percent={72} label="of your week done" />
      </View>
      <View style={styles.copy}>
        <H1>Build habits{"\n"}that actually stick.</H1>
        <Muted>Track anything, earn XP as you go, and let your AI coach keep you on streak.</Muted>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Get started" onPress={() => router.replace("/(tabs)")} />
        <PrimaryButton
          label="I already have an account"
          variant="outline"
          onPress={() => router.replace("/(tabs)")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  top: {
    flex: 1,
    justifyContent: "center",
  },
  copy: {
    gap: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
}));
