import "~/theme/unistyles";

import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnalyticsProvider } from "~/lib/analytics";
import { TRPCProvider } from "~/lib/api";
import { AuthProvider } from "~/lib/auth";
import { initSentry, Sentry } from "~/lib/sentry";

initSentry();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <TRPCProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#0A0A0A" },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="new-habit" options={{ presentation: "modal" }} />
              </Stack>
            </TRPCProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
