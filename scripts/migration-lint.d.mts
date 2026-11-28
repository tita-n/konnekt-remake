export interface DestructiveChange {
  rule: string;
  line: number;
  statement: string;
}

export interface MigrationLintResult {
  failures: string[];
  latest: string | null;
  total: number;
  legacyAllowed: number;
  approved: number;
  manifestUpdated: boolean;
}

export function stripSqlComments(sql: string): string;
export function findDestructiveChanges(sql: string): DestructiveChange[];
export function hasDestructiveApproval(sql: string): boolean;
export function listMigrations(migrationsDir?: string): string[];
export function lintMigrations(options?: {
  migrationsDir?: string;
  baselinePath?: string;
  manifestPath?: string;
  writeManifest?: boolean;
}): MigrationLintResult;
