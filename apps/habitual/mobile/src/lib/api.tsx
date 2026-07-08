import type { AppRouter } from "@habitual/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type ReactNode, useState } from "react";
import superjson from "superjson";

/** Typed tRPC client for Habitual's API. Types flow from `@habitual/core`. */
export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function TRPCProvider(props: {
  children: ReactNode;
  getToken?: () => Promise<string | null>;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          async headers() {
            const token = await props.getToken?.();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </trpc.Provider>
  );
}
