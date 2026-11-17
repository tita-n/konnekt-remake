/**
 * Audience model — the data primitive Phase 1's posts and communities build on.
 *
 * A student path is an ordered tuple:
 *   [universityId, collegeId?, facultyId?, departmentId, level]
 *
 * An audience path is any prefix of that tuple. A viewer can see an audience
 * when their own path starts with the audience path. Sharing is therefore
 * always downward-closed: no audience can ever reach outside the viewer's own
 * university, faculty or department/level.
 *
 * "My Level" always means the viewer's level *in their department*: the level
 * segment is only meaningful after a department segment.
 */
export type PathSegment = string | number;
export type StudentPath = readonly PathSegment[];
export type AudiencePath = readonly PathSegment[];

export type AcademicLayer = "college" | "faculty" | "department";

export interface AcademicRef {
  id: string;
  name: string;
}

export interface StudentPathInput {
  universityId: string;
  college?: AcademicRef | null;
  faculty?: AcademicRef | null;
  department: AcademicRef;
  level: number;
}

export type AudienceScope = "university" | AcademicLayer | "level";

export interface Audience {
  id: string;
  scope: AudienceScope;
  label: string;
  path: AudiencePath;
}

export interface UniversityLayerLabels {
  college?: string;
  faculty?: string;
  department?: string;
}

/**
 * Build the canonical student path from a resolved academic lineage.
 * Missing optional layers are simply absent from the path, so universities
 * that only have faculties and departments produce 3-segment paths.
 */
export function buildStudentPath(input: StudentPathInput): StudentPath {
  if (!input.universityId) throw new Error("buildStudentPath: universityId is required");
  if (!input.department?.id) throw new Error("buildStudentPath: department is required");
  if (!Number.isInteger(input.level) || input.level < 100 || input.level > 900) {
    throw new Error("buildStudentPath: level must be a three-digit class level");
  }

  const path: PathSegment[] = [input.universityId];
  if (input.college) path.push(input.college.id);
  if (input.faculty) path.push(input.faculty.id);
  path.push(input.department.id);
  path.push(input.level);
  return path;
}

/** Parse a materialized academic path ("college/faculty") into ids. */
export function parseNodePath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Build a student path from an AcademicNode-shaped record (department) and its
 * materialized ancestor path, without a database round trip.
 */
export function buildStudentPathFromNode(
  universityId: string,
  department: { id: string; path: string | null | undefined },
  level: number,
): StudentPath {
  const ancestors = parseNodePath(department.path ?? "");
  return [...[universityId, ...ancestors, department.id], level];
}

/**
 * All audiences a student can address, broadest first.
 * IDs are stable and URL-safe so Phase 1 can persist them directly.
 */
export function audienceOptionsFor(input: StudentPathInput, labels: UniversityLayerLabels = {}): Audience[] {
  const path = buildStudentPath(input);
  // Path layout: [university, ...ancestors, department, level]
  const level = path[path.length - 1]!;
  const departmentId = path[path.length - 2]!;
  const ancestors = path.slice(1, -2);

  const university: Audience = {
    id: `university:${input.universityId}`,
    scope: "university",
    label: "Everyone at my university",
    path: [path[0]!],
  };

  const options: Audience[] = [university];

  // Oldest ancestor first: college, then faculty. A path can also contain only
  // a faculty (no college) or neither.
  ancestors.forEach((segment, index) => {
    const isCollege = index === 0 && ancestors.length === 2;
    const scope: AcademicLayer = isCollege ? "college" : "faculty";
    const ref = scope === "college" ? input.college : input.faculty;
    const label = labels[scope] ?? (scope === "college" ? "College" : "Faculty");
    options.push({
      id: `${scope}:${String(segment)}`,
      scope,
      label: ref ? `${label}: ${ref.name}` : label,
      path: path.slice(0, index + 2),
    });
  });

  options.push({
    id: `department:${String(departmentId)}`,
    scope: "department",
    label: `My department${input.department?.name ? `: ${input.department.name}` : ""}`,
    path: path.slice(0, path.length - 1),
  });

  const levelLabel = labels.department ? `${labels.department} level` : "Level";
  options.push({
    id: `level:${String(departmentId)}:${String(level)}`,
    scope: "level",
    label: `${levelLabel} ${String(level)}`,
    path: [...path],
  });

  return options;
}

/**
 * True when `viewerPath` starts with `audiencePath`. Segment comparison is
 * type-tolerant (100 and "100" are the same level) but never fuzzy.
 */
export function canSee(viewerPath: StudentPath, audiencePath: AudiencePath): boolean {
  if (!Array.isArray(viewerPath) || !Array.isArray(audiencePath)) return false;
  // An empty audience would mean "everyone everywhere"; refuse it outright.
  if (audiencePath.length === 0) return false;
  if (audiencePath.length > viewerPath.length) return false;
  for (let i = 0; i < audiencePath.length; i += 1) {
    const expected = audiencePath[i];
    const actual = viewerPath[i];
    if (expected === undefined || actual === undefined) return false;
    if (String(expected) !== String(actual)) return false;
  }
  return true;
}

/** True when the audience is the viewer's own level within their department. */
export function isSameDepartmentLevel(viewerPath: StudentPath, audiencePath: AudiencePath): boolean {
  if (audiencePath.length !== viewerPath.length) return false;
  if (audiencePath.length < 3) return false;
  return canSee(viewerPath, audiencePath);
}
