import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { sendPing } from '../game/api';
import { getFreshCoords } from './useMyLocation';

// On a runner's phone: when a new pin-drop round begins, snapshot the current
// GPS position and publish it once. Hunters never see a live position.
export function useRunnerPings({ code, lobby, me, phase, latestCoords, pings, offset }) {
  const sending = useRef(new Set());
  const [retry, setRetry] = useState(0);
  const round = phase.phase === 'hunt' ? phase.round : -1;
  const active = me?.role === 'runner' && !me.caught && !me.left && round >= 0;
  const alreadySent = pings.some((p) => p.playerId === me?.id && p.round === round);

  useEffect(() => {
    if (!active || alreadySent) return;
    const key = `${lobby.gameId}_${round}`;
    if (sending.current.has(key)) return;
    sending.current.add(key);
    (async () => {
      const coords = latestCoords.current || (await getFreshCoords());
      if (!coords) {
        sending.current.delete(key);
        setTimeout(() => setRetry((n) => n + 1), 3000);
        return;
      }
      try {
        await sendPing(code, {
          gameId: lobby.gameId,
          uid: me.id,
          name: me.name,
          round,
          coords,
          serverNow: Date.now() + offset,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } catch {
        sending.current.delete(key);
        setTimeout(() => setRetry((n) => n + 1), 3000);
      }
    })();
  }, [active, alreadySent, round, code, lobby.gameId, me, latestCoords, offset, retry]);
}
