-- ============================================================
-- Migration: add_audit_log_immutability_and_permissions
-- Enforces Scenario 3 of ticket #205994:
-- "Prevent modification of audit logs"
-- ============================================================

-- ── 1. Append-only enforcement via trigger ───────────────────
-- Any UPDATE or DELETE on inventory_logs raises an exception.
-- This is enforced at the DB level, below the application layer,
-- so no code path — including direct psql or service_role clients
-- — can silently modify or remove a log entry.

CREATE OR REPLACE FUNCTION prevent_inventory_log_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Audit logs are immutable — UPDATE and DELETE are not permitted on inventory_logs (row id: %)',
    OLD.id;
  RETURN NULL;
END;
$$;

-- Apply the guard trigger
DROP TRIGGER IF EXISTS trg_inventory_logs_immutable ON inventory_logs;
CREATE TRIGGER trg_inventory_logs_immutable
  BEFORE UPDATE OR DELETE ON inventory_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_log_modification();

-- ── 2. audit:read permission ──────────────────────────────────
-- Allow ADMIN and MANAGER roles to query inventory_logs via the
-- new GET /api/audit-logs endpoint.

INSERT INTO permissions (name, resource, action, description)
VALUES ('audit:read', 'audit', 'read', 'View audit trail logs')
ON CONFLICT (name) DO NOTHING;

-- Grant to ADMIN and MANAGER roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('ADMIN', 'MANAGER')
  AND p.name = 'audit:read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
