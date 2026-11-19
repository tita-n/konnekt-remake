import { PrismaClient } from "@prisma/client";

/**
 * The unscoped Prisma client. Tenant-facing code must NOT import this module —
 * it exists only for platform-admin operations and infrastructure jobs.
 * Enforced by the no-restricted-imports ESLint rule for app/(app) and app/admin.
 */
const globalForPrisma = globalThis as unknown as {
  konnektPlatformDb?: PrismaClient;
  konnektDbOffline?: boolean;
};

function createMockModel() {
  const noOpModel: Record<string, (args?: Record<string, unknown>) => Promise<unknown>> = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    findFirstOrThrow: async () => {
      throw Object.assign(new Error("Record not found"), { code: "P2025" });
    },
    findUniqueOrThrow: async () => {
      throw Object.assign(new Error("Record not found"), { code: "P2025" });
    },
    count: async () => 0,
    aggregate: async () => ({ _count: 0 }),
    groupBy: async () => [],
    create: async (args) => ({
      id: "mock-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...((args?.data as Record<string, unknown>) ?? {}),
    }),
    createMany: async (args) => ({
      count: Array.isArray(args?.data) ? args.data.length : 0,
    }),
    createManyAndReturn: async (args) => (Array.isArray(args?.data) ? args.data : []),
    update: async (args) => ({
      id: "mock-id",
      ...((args?.data as Record<string, unknown>) ?? {}),
    }),
    updateMany: async () => ({ count: 0 }),
    upsert: async (args) => ({
      id: "mock-id",
      ...((args?.create as Record<string, unknown>) ?? (args?.update as Record<string, unknown>) ?? {}),
    }),
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  };
  return noOpModel;
}

const mockModel = createMockModel();

function callMockOperation(operation: string, args: unknown): Promise<unknown> {
  const fn = mockModel[operation];
  if (fn) return fn(args as Record<string, unknown>);
  return Promise.resolve(null);
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === "PrismaClientInitializationError" || e.name === "PrismaClientRustPanicError") {
    return true;
  }
  if (e.code && ["P1000", "P1001", "P1002", "P1003", "P1008", "P1017"].includes(e.code)) {
    return true;
  }
  const msg = e.message ?? "";
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("Connection terminated") ||
    msg.includes("database system is starting up")
  );
}

function createMockPrisma(): PrismaClient {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "$extends") return () => proxy;
        if (prop === "$transaction") {
          return async (arg: unknown) => {
            if (typeof arg === "function") return arg(proxy);
            if (Array.isArray(arg)) return Promise.all(arg);
            return [];
          };
        }
        if (prop === "$queryRaw" || prop === "$queryRawUnsafe") return async () => [];
        if (prop === "$executeRaw" || prop === "$executeRawUnsafe") return async () => 0;
        if (prop === "$connect" || prop === "$disconnect") return async () => undefined;
        if (prop === "$on") return () => undefined;
        if (prop === "then") return undefined;
        return mockModel;
      },
    },
  );
  return proxy as PrismaClient;
}

function isPlaceholderDatabaseUrl(dbUrl: string): boolean {
  try {
    const normalized = dbUrl.replace(/^postgresql:\/\//i, "http://").replace(/^postgres:\/\//i, "http://");
    const parsed = new URL(normalized);
    return parsed.hostname === "host" || parsed.hostname === "example.com";
  } catch {
    return true;
  }
}

function createPlatformDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl || isPlaceholderDatabaseUrl(dbUrl) || globalForPrisma.konnektDbOffline) {
    console.warn("[AI Studio] Database not configured — using in-memory Prisma mock");
    globalForPrisma.konnektDbOffline = true;
    return createMockPrisma();
  }
  try {
    const raw = new PrismaClient({
      log: [{ emit: "event", level: "error" }],
    });
    const mock = createMockPrisma();
    const extended = raw.$extends({
      name: "aistudio-resilience",
      query: {
        $allModels: {
          async $allOperations({ operation, args, query }) {
            if (globalForPrisma.konnektDbOffline) {
              return callMockOperation(operation, args);
            }
            try {
              return await query(args);
            } catch (err) {
              if (isConnectionError(err)) {
                console.warn("[AI Studio] Database unreachable — switching to in-memory Prisma mock");
                globalForPrisma.konnektDbOffline = true;
                return callMockOperation(operation, args);
              }
              throw err;
            }
          },
        },
      },
    });

    const resilientProxy = new Proxy(extended, {
      get(target, prop) {
        if (prop === "$extends") {
          return (ext: unknown) => (target as unknown as { $extends: (e: unknown) => unknown }).$extends(ext);
        }
        if (prop === "$transaction") {
          return async (arg: unknown, opts?: unknown) => {
            if (globalForPrisma.konnektDbOffline) {
              return (mock.$transaction as (a: unknown) => Promise<unknown>)(arg);
            }
            try {
              return await (target as unknown as { $transaction: (a: unknown, o?: unknown) => Promise<unknown> }).$transaction(arg, opts);
            } catch (err) {
              if (isConnectionError(err)) {
                console.warn("[AI Studio] Database unreachable — switching to in-memory Prisma mock");
                globalForPrisma.konnektDbOffline = true;
                return (mock.$transaction as (a: unknown) => Promise<unknown>)(arg);
              }
              throw err;
            }
          };
        }
        if (prop === "$queryRaw" || prop === "$queryRawUnsafe") {
          return async (...rawArgs: unknown[]) => {
            if (globalForPrisma.konnektDbOffline) return [];
            try {
              const fn = Reflect.get(target, prop, target) as (...a: unknown[]) => Promise<unknown>;
              return await fn.apply(target, rawArgs);
            } catch (err) {
              if (isConnectionError(err)) {
                globalForPrisma.konnektDbOffline = true;
                return [];
              }
              throw err;
            }
          };
        }
        if (prop === "$executeRaw" || prop === "$executeRawUnsafe") {
          return async (...rawArgs: unknown[]) => {
            if (globalForPrisma.konnektDbOffline) return 0;
            try {
              const fn = Reflect.get(target, prop, target) as (...a: unknown[]) => Promise<unknown>;
              return await fn.apply(target, rawArgs);
            } catch (err) {
              if (isConnectionError(err)) {
                globalForPrisma.konnektDbOffline = true;
                return 0;
              }
              throw err;
            }
          };
        }
        return Reflect.get(target, prop, target);
      },
    });

    return resilientProxy as unknown as PrismaClient;
  } catch {
    console.warn("[AI Studio] Database not connected — using mock");
    globalForPrisma.konnektDbOffline = true;
    return createMockPrisma();
  }
}

export const platformDb: PrismaClient =
  globalForPrisma.konnektPlatformDb ?? createPlatformDb();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.konnektPlatformDb = platformDb;
}
