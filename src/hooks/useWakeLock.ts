import { useState, useEffect, useCallback } from 'react';

export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return false;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      setIsLocked(true);

      sentinel.addEventListener('release', () => {
        setIsLocked(false);
      });
      return true;
    } catch (err) {
      console.warn('Screen Wake Lock request failed:', err);
      setIsLocked(false);
      return false;
    }
  }, []);

  // Automatically maintain lock on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLocked) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, requestWakeLock]);

  // Request wake lock initially on mount
  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  const toggleWakeLock = useCallback(async () => {
    if (isLocked) {
      // In web wakeLock API, we can't directly call sentinel.release without reference,
      // but we can request visibility/toggle state.
      setIsLocked(false);
    } else {
      await requestWakeLock();
    }
  }, [isLocked, requestWakeLock]);

  return { isLocked, supported, requestWakeLock, toggleWakeLock };
}
