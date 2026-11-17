import { PrismaClient } from "@prisma/client";

/**
 * The unscoped Prisma client. Tenant-facing code must NOT import this module —
 * it exists only for platform-admin operations and infrastructure jobs.
 * Enforced by the no-restricted-imports ESLint rule for app/(app) and app/admin.
 */
const globalForPrisma = globalThis as unknown as { konnektPlatformDb?: PrismaClient };

export const platformDb =
  globalForPrisma.konnektPlatformDb ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.konnektPlatformDb = platformDb;
}
