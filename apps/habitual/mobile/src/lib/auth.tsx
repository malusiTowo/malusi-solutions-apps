import { ClerkProvider } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

/** Secure token cache backed by the device keychain. */
const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  clearToken: (key: string) => SecureStore.deleteItemAsync(key),
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/** True when Clerk keys are present. Screens can relax the auth gate otherwise. */
export const clerkConfigured = !!publishableKey;

/** Wraps the app in Clerk when configured; a transparent pass-through otherwise
 *  so the skeleton still boots without keys. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}
