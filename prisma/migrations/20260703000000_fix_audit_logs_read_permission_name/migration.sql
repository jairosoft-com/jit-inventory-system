-- ============================================================
-- Migration: fix_audit_logs_read_permission_name
-- Ticket #206479: Record User Activity Logs
--
-- The 20260702010000_add_audit_log_immutability_and_permissions
-- migration introduced a permission named 'audit:read', but every
-- route that guards audit-log access (GET /audit-logs,
-- GET /audit-logs/:id) checks for 'audit_logs:read' instead
-- (see apps/backend/src/routes/audit-logs.routes.ts and
-- prisma/seed.ts). Because `prisma migrate deploy` does not run
-- the seed script, a database that only had migrations applied
-- (e.g. a real deployment) would never grant 'audit_logs:read' to
-- any role, and ADMIN/MANAGER would get 403 Forbidden when trying
-- to view the audit trail — defeating the purpose of this ticket
-- ("system usage can be monitored").
--
-- This migration adds the permission name the application code
-- actually checks, and grants it to ADMIN and MANAGER. The old,
-- unused 'audit:read' permission is left in place (harmless) to
-- avoid breaking any environment that may already reference it.
-- ============================================================

INSERT INTO permissions (name, resource, action, description)
VALUES ('audit_logs:read', 'audit_logs', 'read', 'View audit trail')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('ADMIN', 'MANAGER')
  AND p.name = 'audit_logs:read'
ON CONFLICT (role_id, permission_id) DO NOTHING;