import cron from 'node-cron';
import { AlertService } from '../services/alert.service.js';
import { prisma } from './prisma.js';

// Decision 8 (DevPlan): warranty expiry checks run daily at 08:00 server time.
export function startCronJobs(): void {
  cron.schedule('0 8 * * *', () => {
    void (async () => {
      try {
        await AlertService.runWarrantyScan();
        await AlertService.sendWarrantyDigestEmail();
        console.log('[Cron] Warranty expiry scan completed');
      } catch (err) {
        console.error(
          '[Cron] Warranty expiry scan failed:',
          err instanceof Error ? err.message : err,
        );
      }
    })();
  });

  console.log('[Cron] Warranty expiry job scheduled — daily at 08:00');

  // Purge expired refresh tokens daily at 03:00 server time.
  cron.schedule('0 3 * * *', () => {
    void (async () => {
      try {
        const deleted = await prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        console.log(`[Cron] Purged ${deleted.count} expired refresh tokens`);
      } catch (err) {
        console.error(
          '[Cron] Refresh token cleanup failed:',
          err instanceof Error ? err.message : err,
        );
      }
    })();
  });

  console.log('[Cron] Refresh token cleanup scheduled — daily at 03:00');
}
