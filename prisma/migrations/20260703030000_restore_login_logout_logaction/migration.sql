-- AlterEnum
-- Add back the LOGIN and LOGOUT values that were dropped by the 20260703025420_add_borrow_return_alerts migration
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
