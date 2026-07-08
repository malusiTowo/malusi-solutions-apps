import { appRouter, runtime } from "@habitual/core";
import { createTRPCContext } from "@repo/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const runtimeConfig = "nodejs";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ runtime, request: req }),
    onError({ error, path }) {
      console.error(`[trpc] error on ${path ?? "<no-path>"}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
