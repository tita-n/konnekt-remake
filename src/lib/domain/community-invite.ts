import { createHash, randomBytes } from "node:crypto";
import {
  DEFAULT_INVITE_DAYS,
  MAX_INVITE_DAYS,
  type CommunityInviteStatus,
} from "./community";

export interface InviteRecord {
  status: CommunityInviteStatus;
  expiresAt: Date | string;
  uses: number;
  maxUses: number | null;
  kind: "USER" | "LINK";
  invitedUserId?: string | null;
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiry(days: number, now = new Date()): Date {
  const safe = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), MAX_INVITE_DAYS) : DEFAULT_INVITE_DAYS;
  return new Date(now.getTime() + safe * 24 * 60 * 60 * 1000);
}

export function inviteIsUsable(invite: InviteRecord, now = new Date()): boolean {
  if (invite.status !== "ACTIVE") return false;
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return false;
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return false;
  return true;
}

export function inviteError(invite: InviteRecord | null, now = new Date()): string | null {
  if (!invite) return "This invite isn't available.";
  if (invite.status === "REVOKED") return "This invite was revoked.";
  if (invite.status === "USED") return "This invite has already been used.";
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return "This invite has expired.";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "This invite has reached its limit.";
  return null;
}
