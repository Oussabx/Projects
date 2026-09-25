import { useEffect, useState } from 'react';
import { subscribeLobby, subscribePings } from '../game/api';

// { loading, lobby } — lobby is null once the doc is gone.
export function useLobby(code) {
  const [state, setState] = useState({ loading: true, lobby: null, error: null });
  useEffect(() => {
    if (!code) return undefined;
    setState({ loading: true, lobby: null, error: null });
    return subscribeLobby(
      code,
      (lobby) => setState({ loading: false, lobby, error: null }),
      (error) => setState({ loading: false, lobby: null, error })
    );
  }, [code]);
  return state;
}

export function usePings(code, gameId) {
  const [pings, setPings] = useState([]);
  useEffect(() => {
    setPings([]);
    if (!code || !gameId) return undefined;
    return subscribePings(code, gameId, setPings);
  }, [code, gameId]);
  return pings;
}
