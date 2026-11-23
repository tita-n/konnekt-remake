-- The original trigger returned OLD from a BEFORE UPDATE, which silently
-- reverted every membership update. Keep the last-owner guard, but return NEW
-- so role, status, mute and lastSeenAt changes actually persist.
CREATE OR REPLACE FUNCTION "community_keep_owner"() RETURNS trigger AS $$
DECLARE
  remaining integer;
  parent_exists boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'OWNER' OR OLD.status <> 'ACTIVE' THEN
      RETURN OLD;
    END IF;
    SELECT EXISTS(SELECT 1 FROM "Community" WHERE id = OLD."communityId") INTO parent_exists;
    IF NOT parent_exists THEN
      RETURN OLD;
    END IF;
    SELECT count(*) INTO remaining
    FROM "CommunityMember"
    WHERE "communityId" = OLD."communityId"
      AND id <> OLD.id
      AND role = 'OWNER'
      AND status = 'ACTIVE';
    IF remaining = 0 THEN
      RAISE EXCEPTION 'community must keep at least one owner';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.role <> 'OWNER' OR OLD.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'OWNER' AND NEW.status = 'ACTIVE' THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS(SELECT 1 FROM "Community" WHERE id = OLD."communityId") INTO parent_exists;
  IF NOT parent_exists THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO remaining
  FROM "CommunityMember"
  WHERE "communityId" = OLD."communityId"
    AND id <> OLD.id
    AND role = 'OWNER'
    AND status = 'ACTIVE';
  IF remaining = 0 THEN
    RAISE EXCEPTION 'community must keep at least one owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
