-- ============================================================
-- Migration: add_login_logout_to_logaction_enum
-- Ticket #206479 / Task #207939
--
-- schema.prisma's LogAction enum already listed LOGIN and LOGOUT,
-- but no prior migration ever added those values to the actual
-- Postgres enum type (the original 20260521020039_init migration
-- only created CREATED/UPDATED/DELETED/APPROVED/REJECTED/BORROWED/
-- RETURNED/DISPOSED/TRANSFERRED/MAINTENANCE_STARTED/
-- MAINTENANCE_COMPLETED/RENEWED). As a result, any attempt to write
-- an inventory_logs row with action = 'LOGIN' or 'LOGOUT' fails with
-- Postgres error 22P02 ("invalid input value for enum").
--
-- This migration brings the database enum in sync with the Prisma
-- schema. IF NOT EXISTS makes it safe to re-run.
-- ============================================================

ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGOUT';