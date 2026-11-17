-- Hard database guarantees that the Prisma schema cannot express.
-- These are deliberately enforced in Postgres: application bugs cannot bypass
-- them and they hold for every code path, including future ones.

-- One VERIFIED account per matric number per university.
CREATE UNIQUE INDEX "user_verified_matric_unique"
  ON "User" ("universityId", "matricNormalized")
  WHERE "status" = 'VERIFIED' AND "matricNormalized" IS NOT NULL;

-- At most one PENDING verification request per user.
CREATE UNIQUE INDEX "verification_pending_per_user"
  ON "VerificationRequest" ("userId")
  WHERE "status" = 'PENDING';

-- A matric number can only ever be approved once per university.
CREATE UNIQUE INDEX "verification_approved_matric_unique"
  ON "VerificationRequest" ("universityId", "matricNormalized")
  WHERE "status" = 'APPROVED' AND "matricNormalized" IS NOT NULL;

-- Emails are compared case-insensitively at the database level.
CREATE UNIQUE INDEX "user_email_lower_unique" ON "User" (lower("email"));

-- A role can only be granted once per user/university pair, treating a platform
-- grant (universityId IS NULL) as its own scope.
CREATE UNIQUE INDEX "role_assignment_unique"
  ON "RoleAssignment" ("userId", "role", COALESCE("universityId", 'platform'));

-- AuditLog is append-only. Any UPDATE or DELETE is rejected by the database.
CREATE OR REPLACE FUNCTION konnekt_audit_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION konnekt_audit_log_immutable();
