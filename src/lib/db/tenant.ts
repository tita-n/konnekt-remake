import type { PrismaClient } from "@prisma/client";
import { platformDb } from "./platform";

/**
 * Tenant-scoped data layer.
 *
 * Every tenant-owned model is reachable only through a client bound to one
 * university. The extension injects `universityId` into reads, writes and
 * deletes, so a query that forgets a tenant filter still cannot cross tenants.
 */
const TENANT_MODELS = [
  "AcademicNode",
  "User",
  "RoleAssignment",
  "VerificationRequest",
  "EmailCode",
  "Session",
  "AuditLog",
] as const;

const TENANT_MODEL_SET = new Set<string>(TENANT_MODELS);

type TenantModelName = (typeof TENANT_MODELS)[number];

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const WRITE_OPERATIONS = new Set(["update", "updateMany", "delete", "deleteMany"]);
const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown>;

function whereWithTenant(args: Args, universityId: string): Args {
  const where = (args.where ?? {}) as Args;
  return { ...args, where: { AND: [where, { universityId }] } };
}

function assertSameTenant(data: unknown, universityId: string): void {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const value = (data as { universityId?: unknown }).universityId;
  if (value !== undefined && value !== universityId) {
    throw new Error("Tenant client: refusing to write a row for another university");
  }
}

function injectData(data: unknown, universityId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => injectData(row, universityId));
  }
  if (!data || typeof data !== "object") return data;
  assertSameTenant(data, universityId);
  return { ...(data as Args), universityId };
}

function tenantQueryExtension(universityId: string) {
  return {
    name: `tenant:${universityId}`,
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: Args;
          query: (args: Args) => Promise<unknown>;
        }) {
          if (!model || !TENANT_MODEL_SET.has(model)) {
            return query(args);
          }

          if (READ_OPERATIONS.has(operation) || WRITE_OPERATIONS.has(operation)) {
            return query(whereWithTenant(args, universityId));
          }

          if (operation === "create") {
            return query({ ...args, data: injectData(args.data, universityId) });
          }

          if (CREATE_OPERATIONS.has(operation)) {
            return query({ ...args, data: injectData(args.data, universityId) });
          }

          if (operation === "upsert") {
            assertSameTenant(args.create, universityId);
            assertSameTenant(args.update, universityId);
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { universityId }] },
              create: { ...(args.create as Args), universityId },
              update: { ...(args.update as Args), universityId },
            });
          }

          // Any new Prisma operation on a tenant model must opt in explicitly.
          throw new Error(`Tenant client: unsupported operation ${operation} on ${model}`);
        },
      },
    },
  };
}

/** Models intentionally absent from the tenant-scoped type. */
type PlatformOnlyModelKeys =
  | "university"
  | "waitlistEntry"
  | "$queryRaw"
  | "$queryRawUnsafe"
  | "$executeRaw"
  | "$executeRawUnsafe";

export type TenantClient = Omit<
  PrismaClient,
  PlatformOnlyModelKeys | "$transaction" | "$connect" | "$disconnect" | "$extends" | "$on"
> & {
  $transaction: <R>(fn: (tx: TenantClient) => Promise<R>) => Promise<R>;
};

/**
 * Returns a client scoped to one university. Non-tenant models are not just
 * filtered — they are unavailable, at runtime and in the type system.
 */
export function tenantDb(universityId: string): TenantClient {
  const extended = platformDb.$extends(tenantQueryExtension(universityId));
  return new Proxy(extended, {
    get(target, property, receiver) {
      if (typeof property === "string" && !property.startsWith("$") && !TENANT_MODEL_SET.has(property)) {
        throw new Error(
          `Tenant client: model "${property}" is not tenant-scoped. Use an explicit platform-admin API.`,
        );
      }
      return Reflect.get(target, property, receiver);
    },
  }) as unknown as TenantClient;
}

/**
 * Interactive transaction where every callback query is tenant-scoped.
 * Extensions apply to `$transaction` on an extended client, so the callback's
 * client inherits the same university filter as the outer client.
 */
export async function withTenantTransaction<R>(
  universityId: string,
  fn: (tx: TenantClient) => Promise<R>,
): Promise<R> {
  return tenantDb(universityId).$transaction(fn);
}

export { TENANT_MODELS };
export type { TenantModelName };
