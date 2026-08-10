import { GraphQLError } from "graphql";
import type { Plugin } from "graphql-yoga";

/**
 * tRPC's `timingMiddleware`, at operation rather than procedure granularity — with
 * flat root fields a client can ask for several in a single operation, so one line
 * per operation is the honest unit. Per-field timing would mean `@envelop/on-resolve`,
 * an extra dependency for a dev-only log.
 */
export const useTiming = (): Plugin => ({
  onExecute({ args }) {
    const start = Date.now();
    return {
      onExecuteDone() {
        if (process.env.NODE_ENV === "development") {
          const durationMs = Date.now() - start;
          console.log(`[graphql] ${args.operationName ?? "anonymous"} took ${durationMs}ms`);
        }
      },
    };
  },
});

/**
 * Cap the size of an incoming document.
 *
 * With tRPC the callable surface was fixed by the router; a GraphQL endpoint accepts
 * arbitrary query shapes, so document size is a real amplification vector. Depth and
 * cost limiting are the other half of that story — deliberately not added yet,
 * because a schema with no object-to-object edges cannot be nested into. Add them
 * with the first relation field.
 */
export const useMaxDocumentSize = (max = 8_000): Plugin => ({
  onParams({ params }) {
    if (typeof params.query === "string" && params.query.length > max) {
      throw new GraphQLError("Query document too large", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  },
});
