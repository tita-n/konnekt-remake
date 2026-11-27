import { PrismaClient } from "@prisma/client";
import { recordDbQuery } from "@/lib/perf/trace";

/**
 * The unscoped Prisma client. Tenant-facing code must NOT import this module —
 * it exists only for platform-admin operations and infrastructure jobs.
 * Enforced by the no-restricted-imports ESLint rule for app/(app) and app/admin.
 */
const globalForPrisma = globalThis as unknown as { konnektPlatformDb?: PrismaClient };

const base =
  globalForPrisma.konnektPlatformDb ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

/**
 * Count queries and their wall time for the opt-in performance trace. The
 * recorder is a no-op unless a traced request is in flight, so this adds one
 * null check per query in normal operation.
 */
const timed = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const start = process.hrtime.bigint();
        try {
          return await query(args);
        } finally {
          recordDbQuery(Number(process.hrtime.bigint() - start) / 1_000_000);
        }
      },
    },
  },
});

export const platformDb = timed as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.konnektPlatformDb = base;
}
