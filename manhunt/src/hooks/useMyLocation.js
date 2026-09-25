import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export async function ensureLocationPermission() {
  const services = await Location.hasServicesEnabledAsync();
  if (!services) return { ok: false, reason: 'services' };
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return { ok: true };
  const asked = await Location.requestForegroundPermissionsAsync();
  return { ok: asked.granted, reason: asked.granted ? null : 'denied', canAskAgain: asked.canAskAgain };
}

// Continuously tracks this phone's GPS while `active`. The position stays on
// the device — it is only uploaded when a pin drops (see useRunnerPings).
export function useMyLocation(active = true) {
  const [coords, setCoords] = useState(null);
  const latest = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    let sub;
    let cancelled = false;
    (async () => {
      const { ok } = await ensureLocationPermission();
      if (!ok || cancelled) return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && !cancelled && !latest.current) {
        latest.current = last.coords;
        setCoords(last.coords);
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
        (pos) => {
          latest.current = pos.coords;
          setCoords(pos.coords);
        }
      );
      if (cancelled) sub.remove();
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active]);

  return { coords, latest };
}

export async function getFreshCoords(fallback) {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return pos.coords;
  } catch {
    return fallback || null;
  }
}
