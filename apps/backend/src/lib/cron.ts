import cron from 'node-cron';
import { AlertService } from '../services/alert.service.js';

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
}