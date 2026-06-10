import { useEffect, useRef } from 'react';

/**
 * A hook to perform periodic polling when the tab is active.
 *
 * @param callback The function to execute on each tick
 * @param intervalMs The polling interval in milliseconds (default: 30000)
 * @param enabled Whether polling is active (default: true)
 *
 * @note Fires the callback immediately on mount/enable.
 *   Do not also invoke the callback in a separate useEffect.
 */
export function usePolling(
  callback: () => void,
  intervalMs: number = 30000,
  enabled: boolean = true,
): void {
  const savedCallback = useRef<() => void>(callback);

  // Keep callback reference updated without triggering re-effects
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // Run callback immediately on mount / enabled
    savedCallback.current();

    const tick = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    const intervalId = setInterval(tick, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
