import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listTeam } from "@/lib/services/admin";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const { members, pendingInvites } = await listTeam(user.universityId);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Team</h1>
        <p className="mt-1 max-w-2xl text-small text-fg-muted">
          Give people only what they need. Reviewers see ID images; keep that list small and current.
        </p>
      </header>
      <TeamManager members={members} invites={pendingInvites} />
    </div>
  );
}
