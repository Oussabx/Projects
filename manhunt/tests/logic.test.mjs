import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignRoles,
  checkGameOver,
  formatClock,
  generateCode,
  getPhase,
  modeLabel,
  normalizeCode,
} from '../src/game/logic.js';

const MIN = 60000;
const lobbyAt = (players = {}) => ({
  status: 'playing',
  startAt: 1_000_000,
  settings: { headStartMin: 5, durationMin: 30, pingIntervalMin: 5 },
  players,
});

test('codes are 5 unambiguous chars', () => {
  const code = generateCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeCode(' 7x9-kq!z '), '7X9KQ');
});

test('roles split evenly, hunters never outnumber runners', () => {
  for (let n = 2; n <= 6; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const roles = Object.values(assignRoles(ids));
    const hunters = roles.filter((r) => r === 'hunter').length;
    assert.equal(hunters, Math.floor(n / 2));
    assert.equal(roles.length, n);
  }
  assert.equal(modeLabel(2), '1 VS 1');
  assert.equal(modeLabel(6), '3 VS 3');
  assert.equal(modeLabel(5), '2 VS 3');
});

test('phases: prestart → head start → hunt with pins → over', () => {
  const l = lobbyAt();
  assert.equal(getPhase(l, l.startAt - 1).phase, 'prestart');

  const hs = getPhase(l, l.startAt + 30_000);
  assert.equal(hs.phase, 'headstart');
  assert.equal(hs.remaining, 5 * MIN - 30_000);

  const firstPin = getPhase(l, l.startAt + 5 * MIN);
  assert.equal(firstPin.phase, 'hunt');
  assert.equal(firstPin.round, 0);
  assert.equal(firstPin.nextPingAt, l.startAt + 10 * MIN);

  const later = getPhase(l, l.startAt + 17 * MIN);
  assert.equal(later.round, 2);

  const last = getPhase(l, l.startAt + 34 * MIN);
  assert.equal(last.nextPingAt, null); // no pin at the final whistle

  assert.equal(getPhase(l, l.startAt + 35 * MIN).phase, 'over');
});

test('game over conditions', () => {
  const players = {
    h: { role: 'hunter', joinedAt: 1 },
    r1: { role: 'runner', joinedAt: 2, caught: true },
    r2: { role: 'runner', joinedAt: 3, caught: false },
  };
  const l = lobbyAt(players);
  assert.equal(checkGameOver(l, l.startAt + 10 * MIN), null);
  assert.deepEqual(checkGameOver(l, l.startAt + 35 * MIN), { winner: 'runners', reason: 'time' });
  players.r2.caught = true;
  assert.deepEqual(checkGameOver(l, l.startAt + 10 * MIN), { winner: 'hunters', reason: 'caught' });
  players.r2.caught = false;
  players.h.left = true;
  assert.deepEqual(checkGameOver(l, l.startAt + 10 * MIN), { winner: 'runners', reason: 'forfeit' });
});

test('clock formatting', () => {
  assert.equal(formatClock(5 * MIN), '05:00');
  assert.equal(formatClock(272_000), '04:32');
  assert.equal(formatClock(61 * MIN), '1:01:00');
  assert.equal(formatClock(-5), '00:00');
});
