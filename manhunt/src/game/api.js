import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PRESTART_MS,
  assignRoles,
  generateCode,
  playerList,
} from './logic';

// Data model
//   lobbies/{code}                 one doc per game: status, settings, timing and a `players` map
//   lobbies/{code}/pings/{id}      runner location pins, written only at pin-drop time
//   clocks/{uid}                   scratch doc used to measure phone ↔ server clock offset

const lobbyRef = (code) => doc(db, 'lobbies', code);

function newPlayer(name, locationOk) {
  return {
    name,
    role: null,
    joinedAt: Date.now(),
    locationOk,
    caught: false,
    caughtAt: null,
    caughtBy: null,
    catchClaim: null,
    left: false,
  };
}

export async function createLobby(uid, name, locationOk) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const created = await runTransaction(db, async (tx) => {
      const snap = await tx.get(lobbyRef(code));
      if (snap.exists()) return false;
      tx.set(lobbyRef(code), {
        code,
        hostId: uid,
        status: 'lobby',
        settings: DEFAULT_SETTINGS,
        players: { [uid]: newPlayer(name, locationOk) },
        startAt: null,
        gameId: null,
        winner: null,
        endReason: null,
        endedAt: null,
        createdAt: serverTimestamp(),
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error('Could not create a lobby, try again.');
}

export async function joinLobby(code, uid, name, locationOk) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) throw new Error('No lobby with that code.');
    const lobby = snap.data();
    if (lobby.players?.[uid]) {
      tx.update(lobbyRef(code), { [`players.${uid}.name`]: name, [`players.${uid}.locationOk`]: locationOk });
      return;
    }
    if (lobby.status !== 'lobby') throw new Error('That game has already started.');
    if (Object.keys(lobby.players || {}).length >= MAX_PLAYERS) throw new Error('Lobby is full (max 6).');
    tx.update(lobbyRef(code), { [`players.${uid}`]: newPlayer(name, locationOk) });
  });
}

export async function leaveLobby(code, uid) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) return;
    const lobby = snap.data();
    if (lobby.status === 'playing') {
      // Mid-game you can't vanish from the scoreboard — you forfeit instead.
      tx.update(lobbyRef(code), { [`players.${uid}.left`]: true });
      return;
    }
    const others = playerList(lobby).filter((p) => p.id !== uid);
    if (!others.length) {
      tx.delete(lobbyRef(code));
      return;
    }
    const update = { [`players.${uid}`]: deleteField() };
    if (lobby.hostId === uid) update.hostId = others[0].id;
    tx.update(lobbyRef(code), update);
  });
}

export function kickPlayer(code, uid) {
  return updateDoc(lobbyRef(code), { [`players.${uid}`]: deleteField() });
}

export function updateSettings(code, settings) {
  return updateDoc(lobbyRef(code), { settings });
}

export function setLocationOk(code, uid, ok) {
  return updateDoc(lobbyRef(code), { [`players.${uid}.locationOk`]: ok });
}

export async function startGame(code, serverNow) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    const lobby = snap.data();
    const players = playerList(lobby);
    if (players.length < MIN_PLAYERS) throw new Error('You need at least 2 players.');
    if (players.some((p) => !p.locationOk)) throw new Error('Everyone needs location turned on.');
    const roles = assignRoles(players.map((p) => p.id));
    const startAt = serverNow + PRESTART_MS;
    const update = { status: 'playing', startAt, gameId: String(startAt), winner: null, endReason: null, endedAt: null };
    for (const p of players) {
      update[`players.${p.id}.role`] = roles[p.id];
      update[`players.${p.id}.caught`] = false;
      update[`players.${p.id}.caughtAt`] = null;
      update[`players.${p.id}.caughtBy`] = null;
      update[`players.${p.id}.catchClaim`] = null;
      update[`players.${p.id}.left`] = false;
    }
    tx.update(lobbyRef(code), update);
  });
}

export async function endGame(code, winner, reason, serverNow) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists() || snap.data().status !== 'playing') return;
    tx.update(lobbyRef(code), { status: 'ended', winner, endReason: reason, endedAt: serverNow });
  });
}

// Host sends everyone back to the lobby for a rematch; roles get re-rolled on start.
export async function backToLobby(code) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) return;
    const lobby = snap.data();
    const update = { status: 'lobby', startAt: null, winner: null, endReason: null, endedAt: null };
    for (const p of playerList(lobby)) {
      if (p.left) update[`players.${p.id}`] = deleteField();
      else update[`players.${p.id}.role`] = null;
    }
    tx.update(lobbyRef(code), update);
  });
}

export function claimCatch(code, runnerId, hunterId, hunterName, serverNow) {
  return updateDoc(lobbyRef(code), {
    [`players.${runnerId}.catchClaim`]: { by: hunterId, byName: hunterName, at: serverNow },
  });
}

export function answerCatchClaim(code, runnerId, accepted, serverNow, hunterId) {
  if (!accepted) return updateDoc(lobbyRef(code), { [`players.${runnerId}.catchClaim`]: null });
  return markCaught(code, runnerId, hunterId, serverNow);
}

export function markCaught(code, runnerId, hunterId, serverNow) {
  return updateDoc(lobbyRef(code), {
    [`players.${runnerId}.caught`]: true,
    [`players.${runnerId}.caughtAt`]: serverNow,
    [`players.${runnerId}.caughtBy`]: hunterId || null,
    [`players.${runnerId}.catchClaim`]: null,
  });
}

export function sendPing(code, { gameId, uid, name, round, coords, serverNow }) {
  return setDoc(doc(db, 'lobbies', code, 'pings', `${gameId}_${uid}_${round}`), {
    gameId,
    playerId: uid,
    name,
    round,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? null,
    at: serverNow,
  });
}

export function subscribeLobby(code, onData, onError) {
  return onSnapshot(
    lobbyRef(code),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export function subscribePings(code, gameId, onData) {
  const q = query(collection(db, 'lobbies', code, 'pings'), where('gameId', '==', gameId));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function lobbyExists(code) {
  const snap = await getDoc(lobbyRef(code));
  return snap.exists();
}

// Phones' clocks drift; measure how far ours is from Firestore's so every
// device flips phases (head start over, pin drop) at the same moment.
export async function measureClockOffset(uid) {
  const ref = doc(db, 'clocks', uid);
  const sentAt = Date.now();
  await setDoc(ref, { t: serverTimestamp() });
  const ackAt = Date.now();
  const snap = await getDocFromServer(ref);
  const server = snap.data().t.toMillis();
  const offset = server - (sentAt + ackAt) / 2;
  deleteDoc(ref).catch(() => {});
  return offset;
}
