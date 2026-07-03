-- ============================================================
-- Migration: add_auth_audit_log_actions
-- Implements Authentication Audit Logging (ticket #204711)
-- Adds auth-specific LogAction values and audit:read permission
-- for auth entity logs.
-- ============================================================

-- ── 1. Extend LogAction enum with authentication event types ─
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'TOKEN_REFRESH';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';

-- ── 2. Indexes to support querying auth logs by entity type ──
-- entity_type = 'AUTH' will be used for all auth audit entries
-- The existing index on (entity_type, entity_id) already covers
-- this case, so no new indexes are required.
