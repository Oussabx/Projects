// Pure game rules — no Firebase, no React. Everything time-based works on
// server-aligned epoch milliseconds so every phone agrees on the phase.

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const PRESTART_MS = 10 * 1000;
export const HEAD_START_OPTIONS = [3, 5, 10]; // minutes
export const DURATION_OPTIONS = [30, 45, 60, 90]; // minutes of hunting after the head start
export const PING_OPTIONS = [2, 3, 5, 10]; // minutes between location pins

export const DEFAULT_SETTINGS = {
  headStartMin: 5,
  durationMin: 45,
  pingIntervalMin: 5,
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 5, rand = Math.random) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return code;
}

export function normalizeCode(input) {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export function teamSizes(playerCount) {
  const hunters = Math.max(1, Math.floor(playerCount / 2));
  return { hunters, runners: Math.max(0, playerCount - hunters) };
}

export function modeLabel(playerCount) {
  if (playerCount < MIN_PLAYERS) return 'WAITING';
  const { hunters, runners } = teamSizes(playerCount);
  return `${hunters} VS ${runners}`;
}

// Randomly splits players: floor(n/2) hunters, the rest runners.
export function assignRoles(playerIds, rand = Math.random) {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const { hunters } = teamSizes(shuffled.length);
  const roles = {};
  shuffled.forEach((id, i) => {
    roles[id] = i < hunters ? 'hunter' : 'runner';
  });
  return roles;
}

export function timeline(lobby) {
  const s = lobby.settings || DEFAULT_SETTINGS;
  const startAt = lobby.startAt;
  const huntStartAt = startAt + s.headStartMin * 60000;
  const endAt = huntStartAt + s.durationMin * 60000;
  return { startAt, huntStartAt, endAt, pingMs: s.pingIntervalMin * 60000 };
}

// Where are we in the game at `now`?
//  prestart  → "Get ready" countdown, nobody moves yet
//  headstart → runners flee, hunters wait for the first pin
//  hunt      → a pin drops at huntStartAt and then every ping interval
//  over      → time is up, runners win
export function getPhase(lobby, now) {
  const { startAt, huntStartAt, endAt, pingMs } = timeline(lobby);
  if (now < startAt) {
    return { phase: 'prestart', remaining: startAt - now, nextPingAt: huntStartAt, round: -1, endAt };
  }
  if (now < huntStartAt) {
    return { phase: 'headstart', remaining: huntStartAt - now, nextPingAt: huntStartAt, round: -1, endAt };
  }
  if (now < endAt) {
    const round = Math.floor((now - huntStartAt) / pingMs);
    const next = huntStartAt + (round + 1) * pingMs;
    return {
      phase: 'hunt',
      remaining: endAt - now,
      nextPingAt: next < endAt ? next : null,
      round,
      endAt,
    };
  }
  return { phase: 'over', remaining: 0, nextPingAt: null, round: -1, endAt };
}

export function playerList(lobby) {
  return Object.entries(lobby.players || {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

export function activeRunners(lobby) {
  return playerList(lobby).filter((p) => p.role === 'runner' && !p.caught && !p.left);
}

export function activeHunters(lobby) {
  return playerList(lobby).filter((p) => p.role === 'hunter' && !p.left);
}

// Returns { winner, reason } once the game should end, otherwise null.
export function checkGameOver(lobby, now) {
  if (lobby.status !== 'playing') return null;
  const runners = playerList(lobby).filter((p) => p.role === 'runner');
  if (runners.length && activeRunners(lobby).length === 0) return { winner: 'hunters', reason: 'caught' };
  if (!activeHunters(lobby).length) return { winner: 'runners', reason: 'forfeit' };
  if (getPhase(lobby, now).phase === 'over') return { winner: 'runners', reason: 'time' };
  return null;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatAgo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// Latest ping per player, plus the full trail, for the current game only.
export function groupPings(pings) {
  const latest = {};
  for (const p of pings) {
    if (!latest[p.playerId] || p.round > latest[p.playerId].round) latest[p.playerId] = p;
  }
  return latest;
}
