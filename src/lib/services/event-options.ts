import "server-only";
import { tenantDb } from "@/lib/db/tenant";
import { listCommunityOptions } from "./communities";
import { listCampusPlacesForPicker } from "./event-admin";
import { getOfficialPostingContext } from "./official";
import type { SocialViewer } from "./social";
import type { EventAudienceKind } from "@/lib/domain/events";

export interface EventAudienceOption {
  id: string;
  label: string;
  kind: Exclude<EventAudienceKind, "COMMUNITY">;
  path: string[];
}

export interface EventComposerOptions {
  audiences: EventAudienceOption[];
  communities: Array<{ id: string; name: string; iconUrl: string | null }>;
  officialAccounts: Array<{ id: string; name: string; slug: string }>;
  places: Array<{ id: string; name: string }>;
}

/**
 * Everything the event composer may offer this viewer. Communities only appear
 * when the viewer can organise for them; official accounts only when the
 * viewer is active staff of that account. The server re-checks every choice on
 * create/update, so this is presentation data, not authorization.
 */
export async function getEventComposerOptions(viewer: SocialViewer): Promise<EventComposerOptions> {
  const db = tenantDb(viewer.universityId);
  const [membershipRows, official, places] = await Promise.all([
    db.communityMember.findMany({
      where: { userId: viewer.userId, status: "ACTIVE", community: { status: "ACTIVE" } },
      select: { role: true, communityId: true, community: { select: { allowMemberEvents: true } } },
    }),
    getOfficialPostingContext(viewer),
    listCampusPlacesForPicker(viewer),
  ]);
  const organiserCommunityIds = new Set(
    membershipRows
      .filter(
        (row) =>
          row.role === "OWNER" ||
          row.role === "MODERATOR" ||
          (row.role === "MEMBER" && row.community.allowMemberEvents),
      )
      .map((row) => row.communityId),
  );
  const communityOptions = await listCommunityOptions(viewer);

  const path = [...viewer.studentPath.map(String)];
  const level = path.pop()!;
  const departmentId = path.pop()!;
  const universityId = path[0]!;
  const ancestorIds = path.slice(1);
  const collegeId = viewer.lineage.college ? ancestorIds[0] ?? null : null;
  const facultyId = viewer.lineage.faculty
    ? ancestorIds[viewer.lineage.college ? 1 : 0] ?? null
    : null;

  const pathTo = (ids: string[]) => [universityId, ...ids];
  const audiences: EventAudienceOption[] = [
    { id: "university", label: "Everyone at my university", kind: "PUBLIC", path: ["PUBLIC"] },
  ];
  if (collegeId) {
    audiences.push({
      id: "college",
      label: viewer.lineage.college ?? "My college",
      kind: "COLLEGE",
      path: pathTo([collegeId]),
    });
  }
  if (facultyId) {
    audiences.push({
      id: "faculty",
      label: viewer.lineage.faculty ?? "My faculty",
      kind: "FACULTY",
      path: pathTo([...(collegeId ? [collegeId] : []), facultyId]),
    });
  }
  audiences.push(
    {
      id: "department",
      label: viewer.lineage.department ?? "My department",
      kind: "DEPARTMENT",
      path: pathTo([...(collegeId ? [collegeId] : []), ...(facultyId ? [facultyId] : []), departmentId]),
    },
    {
      id: "level",
      label: `Level ${level} in my department`,
      kind: "LEVEL",
      path: pathTo([...(collegeId ? [collegeId] : []), ...(facultyId ? [facultyId] : []), departmentId, level]),
    },
  );

  return {
    audiences,
    communities: communityOptions
      .filter((community) => organiserCommunityIds.has(community.id))
      .map((community) => ({ id: community.id, name: community.name, iconUrl: community.iconUrl })),
    officialAccounts: official.accounts.map((account) => ({ id: account.id, name: account.name, slug: account.slug })),
    places,
  };
}
