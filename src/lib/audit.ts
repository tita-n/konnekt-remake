import "server-only";
import type { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { hashIp } from "@/lib/crypto";

/**
 * Append-only audit trail. The database rejects UPDATE/DELETE on AuditLog, so
 * this is the only write path. Metadata must never contain PII: ids, counts,
 * reasons and old/new status values only.
 */
export interface AuditEvent {
  actorId: string | null;
  universityId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

export async function writeAudit(event: AuditEvent): Promise<void> {
  await platformDb.auditLog.create({
    data: {
      actorId: event.actorId,
      universityId: event.universityId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      metadata: event.metadata ?? {},
      ipHash: hashIp(event.ip),
    },
  });
}

/**
 * For admin and security actions the audit write is part of the operation:
 * if it cannot be written, the caller is told and the request surfaces a 500.
 */
export async function audited<T>(event: AuditEvent, operation: () => Promise<T>): Promise<T> {
  const result = await operation();
  await writeAudit(event);
  return result;
}

export function requestIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
