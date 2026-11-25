import "server-only";
import { writeAudit } from "@/lib/audit";
import { tenantDb } from "@/lib/db/tenant";
import {
  eventPermissions,
  type EventAudienceKind,
  type EventCategory,
  type EventOrganiserKind,
  type EventStatus,
} from "@/lib/domain/events";
import { SocialError } from "@/lib/posts/errors";
import type { SocialViewer } from "./social";
import { eventSelect, serializeEvent, type EventRow } from "./events";

export interface CampusPlaceView {
  id: string;
  name: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  eventCount: number;
}

export async function listCampusPlacesForPicker(viewer: SocialViewer): Promise<Array<{ id: string; name: string }>> {
  const db = tenantDb(viewer.universityId);
  return db.campusPlace.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function listCampusPlaces(viewer: SocialViewer): Promise<CampusPlaceView[]> {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("You don't have access to campus places.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  const rows = await db.campusPlace.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      latitude: true,
      longitude: true,
      _count: { select: { events: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    latitude: row.latitude,
    longitude: row.longitude,
    eventCount: row._count.events,
  }));
}

function placeCoordinates(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return { latitude: null, longitude: null };
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new SocialError("Enter valid coordinates, or leave them blank.");
  }
  return { latitude, longitude };
}

export async function createCampusPlace(
  viewer: SocialViewer,
  input: { name: string; latitude?: number | null; longitude?: number | null },
): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage campus places.", 403, "forbidden");
  const name = input.name.trim();
  if (name.length < 2) throw new SocialError("Give the place a name.");
  if (name.length > 80) throw new SocialError("Keep the place name under 80 characters.");
  const db = tenantDb(viewer.universityId);
  const existing = await db.campusPlace.findFirst({ where: { name }, select: { id: true } });
  if (existing) throw new SocialError("That campus place already exists.", 409, "duplicate");
  const coords = placeCoordinates(input.latitude, input.longitude);
  const created = await db.campusPlace.create({
    data: { universityId: viewer.universityId, name, ...coords },
    select: { id: true },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "campus_place.create",
    targetType: "CampusPlace",
    targetId: created.id,
    metadata: { name },
  });
  return created;
}

export async function updateCampusPlace(
  viewer: SocialViewer,
  placeId: string,
  input: { name?: string; active?: boolean; latitude?: number | null; longitude?: number | null },
): Promise<{ id: string }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage campus places.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const row = await db.campusPlace.findFirst({ where: { id: placeId }, select: { id: true, name: true } });
  if (!row) throw new SocialError("That campus place isn't available.", 404, "not_available");
  const name = input.name?.trim() ?? row.name;
  if (name.length < 2 || name.length > 80) throw new SocialError("Keep the place name between 2 and 80 characters.");
  const coords =
    input.latitude === undefined && input.longitude === undefined
      ? {}
      : placeCoordinates(input.latitude, input.longitude);
  await db.campusPlace.update({
    where: { id: placeId },
    data: { name, active: input.active, ...coords },
  });
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: "campus_place.edit",
    targetType: "CampusPlace",
    targetId: placeId,
    metadata: { active: input.active ?? null },
  });
  return { id: placeId };
}

export async function deleteCampusPlace(viewer: SocialViewer, placeId: string): Promise<{ deleted: true }> {
  if (!viewer.isUniversityAdmin) throw new SocialError("Only university admins can manage campus places.", 403, "forbidden");
  const db = tenantDb(viewer.universityId);
  const row = await db.campusPlace.findFirst({
    where: { id: placeId },
    select: { id: true, _count: { select: { events: true } } },
  });
  if (!row) throw new SocialError("That campus place isn't available.", 404, "not_available");
  if (row._count.events > 0) {
    await db.campusPlace.update({ where: { id: placeId }, data: { active: false } });
  } else {
    await db.campusPlace.delete({ where: { id: placeId } });
  }
  await writeAudit({
    actorId: viewer.userId,
    universityId: viewer.universityId,
    action: row._count.events > 0 ? "campus_place.deactivate" : "campus_place.delete",
    targetType: "CampusPlace",
    targetId: placeId,
    metadata: { events: row._count.events },
  });
  return { deleted: true };
}

export interface ModerationEventRow {
  id: string;
  title: string;
  status: EventStatus;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  goingCount: number;
  organiser: string;
  organiserKind: EventOrganiserKind;
  audienceKind: EventAudienceKind;
  rsvpCount: number;
  reportCount: number;
}

export async function listEventsForModeration(
  viewer: SocialViewer,
  options: { q?: string; status?: EventStatus | "ALL"; category?: EventCategory | null } = {},
): Promise<ModerationEventRow[]> {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("You don't have access to event moderation.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  const q = options.q?.trim() ?? "";
  const rows = await db.event.findMany({
    where: {
      ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(q.length >= 2
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { venueName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      startsAt: true,
      endsAt: true,
      goingCount: true,
      organiserKind: true,
      audienceKind: true,
      createdBy: { select: { fullName: true } },
      community: { select: { name: true } },
      officialAccount: { select: { name: true } },
      _count: { select: { rsvps: true } },
    },
  });
  const reportCounts = rows.length
    ? await db.report.groupBy({
        by: ["targetId"],
        where: { targetType: "EVENT", targetId: { in: rows.map((row) => row.id) } },
        _count: { _all: true },
      })
    : [];
  const reportsByEvent = new Map(reportCounts.map((entry) => [entry.targetId, entry._count._all]));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    goingCount: row.goingCount,
    organiser:
      row.organiserKind === "COMMUNITY"
        ? row.community?.name ?? "Community"
        : row.organiserKind === "OFFICIAL"
          ? row.officialAccount?.name ?? "Official account"
          : row.createdBy.fullName,
    organiserKind: row.organiserKind,
    audienceKind: row.audienceKind,
    rsvpCount: row._count.rsvps,
    reportCount: reportsByEvent.get(row.id) ?? 0,
  }));
}

export async function getEventModerationDetail(viewer: SocialViewer, eventId: string) {
  if (!viewer.isUniversityAdmin && !viewer.isUniversityModerator) {
    throw new SocialError("You don't have access to event moderation.", 403, "forbidden");
  }
  const db = tenantDb(viewer.universityId);
  const row = await db.event.findFirst({ where: { id: eventId }, select: eventSelect });
  if (!row) throw new SocialError("That event isn't available.", 404, "not_available");
  const permissions = eventPermissions(
    {
      userId: viewer.userId,
      isUniversityAdmin: viewer.isUniversityAdmin,
      isUniversityModerator: viewer.isUniversityModerator,
    },
    row as EventRow,
  );
  return { event: serializeEvent(row), permissions };
}
