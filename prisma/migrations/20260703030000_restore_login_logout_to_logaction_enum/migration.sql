-- ============================================================
-- Migration: restore_login_logout_to_logaction_enum
--
-- A later migration recreated the LogAction enum without LOGIN and
-- LOGOUT, but the auth service records those actions on successful
-- login/logout. Re-add both values so inventory log writes succeed.
-- ============================================================

ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGOUT';