import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listAcademicNodes } from "@/lib/services/academic";
import { parseLabels } from "@/lib/services/universities";
import { AcademicTreeEditor } from "@/components/admin/academic-tree-editor";

export const metadata: Metadata = { title: "Academic tree" };

export default async function AcademicPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const nodes = await listAcademicNodes(user.universityId);
  const labels = parseLabels(user.university.labels);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Academic tree</h1>
        <p className="mt-1 max-w-2xl text-small text-fg-muted">
          This is what students see when they pick where they study. Deactivating a node hides it from onboarding
          without breaking anyone already there.
        </p>
      </header>
      <AcademicTreeEditor
        nodes={nodes.map((node) => ({
          id: node.id,
          parentId: node.parentId,
          type: node.type,
          name: node.name,
          isActive: node.isActive,
          levels: node.levels,
        }))}
        labels={labels}
      />
    </div>
  );
}
