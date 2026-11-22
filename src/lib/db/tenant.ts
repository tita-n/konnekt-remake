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
  "RoleInvite",
  "Post",
  "PostRevision",
  "PostMedia",
  "Poll",
  "PollOption",
  "PollVote",
  "Comment",
  "HelpfulMark",
  "Reaction",
  "Bookmark",
  "Hashtag",
  "PostHashtag",
  "Mention",
  "Draft",
  "Mute",
  "Block",
  "Report",
  "ModerationAction",
  "Strike",
  "Community",
  "CommunityMember",
  "JoinRequest",
  "CommunityInvite",
  "CommunityRule",
  "CommunityResource",
  "CommunityPin",
  "CommunityOfficialRequest",
] as const;

const TENANT_MODEL_SET = new Set<string>(TENANT_MODELS);
const TENANT_PROPERTY_SET = new Set<string>(TENANT_MODELS.map((model) => model.charAt(0).toLowerCase() + model.slice(1)));

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
  /** Raw (unscoped) model access used only to verify tenant ownership. */
  const rawModel = (model: string) =>
    (platformDb as unknown as Record<string, {
      findFirst: (args: unknown) => Promise<unknown>;
    }>)[model]!;

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

          // findFirst accepts a composite filter, so the tenant can be ANDed in.
          if (READ_OPERATIONS.has(operation) && operation !== "findUnique" && operation !== "findUniqueOrThrow") {
            return query(whereWithTenant(args, universityId));
          }

          // findUnique only accepts a unique filter. Resolve it through findFirst
          // with the tenant ANDed in, so another tenant's row is simply absent.
          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const result = await rawModel(model).findFirst(whereWithTenant(args, universityId));
            if (result == null && operation === "findUniqueOrThrow") {
              throw Object.assign(new Error("Record not found"), { code: "P2025" });
            }
            return result;
          }

          if (operation === "updateMany" || operation === "deleteMany") {
            return query(whereWithTenant(args, universityId));
          }

          // Single-row update/delete require a unique where. Verify ownership
          // first, then run the original unique query.
          if (operation === "update" || operation === "delete") {
            const existing = await rawModel(model).findFirst(
              whereWithTenant({ where: args.where, select: { id: true } }, universityId),
            );
            if (!existing) {
              throw Object.assign(new Error("Record not found"), { code: "P2025" });
            }
            if (operation === "update") assertSameTenant(args.data, universityId);
            return query(args);
          }

          if (operation === "create" || CREATE_OPERATIONS.has(operation)) {
            return query({ ...args, data: injectData(args.data, universityId) });
          }

          if (operation === "upsert") {
            assertSameTenant(args.create, universityId);
            assertSameTenant(args.update, universityId);
            const existing = await rawModel(model).findFirst({
              where: args.where,
              select: { id: true, universityId: true },
            });
            if (
              existing &&
              typeof existing === "object" &&
              (existing as { universityId?: string }).universityId !== universityId
            ) {
              throw new Error("Tenant client: refusing to upsert another university's row");
            }
            return query({
              ...args,
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
      if (
        typeof property === "string" &&
        !property.startsWith("$") &&
        !property.startsWith("_") &&
        !TENANT_PROPERTY_SET.has(property)
      ) {
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
