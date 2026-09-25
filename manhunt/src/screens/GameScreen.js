import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Screen } from '../components/ui';
import { darkMapStyle } from '../components/mapStyle';
import { answerCatchClaim, claimCatch, endGame, markCaught } from '../game/api';
import {
  activeRunners,
  checkGameOver,
  distanceMeters,
  formatAgo,
  formatClock,
  formatDistance,
  getPhase,
  groupPings,
  playerList,
  timeline,
} from '../game/logic';
import { usePings } from '../hooks/useLobby';
import { useMyLocation } from '../hooks/useMyLocation';
import { useRunnerPings } from '../hooks/useRunnerPings';
import { colors, fonts, roleColor } from '../theme';

const BANNER_MS = 20000;

export function GameScreen({ lobby, uid, now, offset, onLeave }) {
  const me = { id: uid, ...lobby.players[uid] };
  const isRunner = me.role === 'runner';
  const accent = roleColor(me.role);
  const phase = getPhase(lobby, now);
  const { huntStartAt, pingMs } = timeline(lobby);
  const pings = usePings(lobby.code, lobby.gameId);
  const { coords, latest } = useMyLocation(true);
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  useRunnerPings({ code: lobby.code, lobby, me, phase, latestCoords: latest, pings, offset });

  const players = playerList(lobby);
  const runners = players.filter((p) => p.role === 'runner');
  const freeRunners = activeRunners(lobby);
  const latestPins = useMemo(() => groupPings(pings), [pings]);
  const trails = useMemo(() => {
    const byPlayer = {};
    for (const p of [...pings].sort((a, b) => a.round - b.round)) (byPlayer[p.playerId] ||= []).push(p);
    return byPlayer;
  }, [pings]);

  // Whoever notices first ends the game; the transaction makes it idempotent.
  const over = checkGameOver(lobby, now);
  const ending = useRef(false);
  useEffect(() => {
    if (!over || ending.current) return;
    ending.current = true;
    endGame(lobby.code, over.winner, over.reason, now).catch(() => {
      ending.current = false;
    });
  }, [over?.winner, over?.reason]); // eslint-disable-line react-hooks/exhaustive-deps

  // Center on me once GPS locks.
  const centered = useRef(false);
  useEffect(() => {
    if (!coords || centered.current || !mapRef.current) return;
    centered.current = true;
    mapRef.current.animateToRegion(
      { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      600
    );
  }, [coords]);

  // Hunters: buzz and zoom out to fit when new pins drop.
  const seenPings = useRef(0);
  useEffect(() => {
    if (pings.length > seenPings.current) {
      if (!isRunner) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        fitToPins();
      }
    }
    seenPings.current = pings.length;
  }, [pings.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function fitToPins() {
    const points = Object.values(latestPins).map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (coords) points.push({ latitude: coords.latitude, longitude: coords.longitude });
    if (!points.length || !mapRef.current) return;
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }

  function recenter() {
    if (!coords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      400
    );
  }

  function focusPin(pin) {
    mapRef.current?.animateToRegion(
      { latitude: pin.latitude, longitude: pin.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      400
    );
  }

  function openMenu() {
    const buttons = [{ text: 'Cancel', style: 'cancel' }];
    if (lobby.hostId === uid) {
      buttons.push({
        text: 'End game for everyone',
        style: 'destructive',
        onPress: () => endGame(lobby.code, 'none', 'host', now),
      });
    }
    buttons.push({
      text: isRunner ? 'Quit (counts as caught)' : 'Quit game',
      style: 'destructive',
      onPress: onLeave,
    });
    Alert.alert('Game menu', undefined, buttons);
  }

  function tagRunner(runner) {
    Alert.alert(`Caught ${runner.name}?`, `${runner.name} will be asked to confirm on their phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, caught',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          claimCatch(lobby.code, runner.id, uid, me.name, now);
        },
      },
    ]);
  }

  function surrender() {
    Alert.alert('Were you caught?', 'You will be out for the rest of this game.', [
      { text: 'No', style: 'cancel' },
      { text: "Yes, I'm caught", style: 'destructive', onPress: () => markCaught(lobby.code, uid, null, now) },
    ]);
  }

  // ---- Timer card copy ----
  let timerLabel;
  let timerValue;
  let warn = false;
  if (isRunner && me.caught) {
    timerLabel = 'You were caught';
    timerValue = 'OUT';
  } else if (phase.phase === 'headstart') {
    timerLabel = isRunner ? 'Head start' : 'First location in';
    timerValue = formatClock(phase.remaining);
  } else if (phase.nextPingAt) {
    const ms = phase.nextPingAt - now;
    timerLabel = isRunner ? 'Next pin drop in' : 'Next location in';
    timerValue = formatClock(ms);
    warn = isRunner && ms <= 30000;
  } else {
    timerLabel = isRunner ? 'Survive for' : 'Last chance';
    timerValue = formatClock(phase.remaining);
  }

  const roundStartedAt = phase.phase === 'hunt' ? huntStartAt + phase.round * pingMs : null;
  const showBanner = roundStartedAt && now - roundStartedAt < BANNER_MS;
  const bannerText = isRunner
    ? me.caught
      ? null
      : 'Your location was just sent to the hunters. Move!'
    : `${phase.round === 0 ? 'First' : 'New'} location pins dropped`;

  const claim = isRunner && !me.caught ? me.catchClaim : null;

  return (
    <Screen edges={['top']}>
      <View style={styles.top}>
        <Pressable onPress={openMenu} hitSlop={12} style={styles.topSide} accessibilityLabel="Game menu">
          <Ionicons name="menu" size={24} color={colors.white} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.youre}>You're a</Text>
          <Text style={[styles.role, { color: accent }]}>{isRunner ? 'RUNNER' : 'HUNTER'}</Text>
        </View>
        <View style={[styles.topSide, { alignItems: 'flex-end' }]}>
          <Text style={styles.leftLabel}>TIME LEFT</Text>
          <Text style={styles.leftValue}>{formatClock(phase.endAt - now)}</Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <MaterialCommunityIcons name={isRunner ? 'run-fast' : 'car-sports'} size={30} color={accent} />
        <View
          style={[
            styles.timerCard,
            { borderColor: warn ? colors.orange : colors.border, backgroundColor: warn ? colors.orangeDim : colors.panel },
          ]}
        >
          <Text style={styles.timerLabel}>{timerLabel}</Text>
          <Text style={[styles.timerValue, { color: warn ? colors.orange : accent }]}>{timerValue}</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={darkMapStyle}
          userInterfaceStyle="dark"
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          showsPointsOfInterest={false}
        >
          {runners.map((r) => {
            const trail = trails[r.id] || [];
            const pin = latestPins[r.id];
            if (!pin) return null;
            const color = r.caught || r.left ? colors.graphite : isRunner ? colors.runner : colors.orange;
            return (
              <Fragment key={r.id}>
                {trail.length > 1 ? (
                  <Polyline
                    coordinates={trail.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))}
                    strokeColor={color}
                    strokeWidth={2}
                    lineDashPattern={[6, 6]}
                  />
                ) : null}
                {trail.slice(0, -1).map((p) => (
                  <Marker key={p.id} coordinate={{ latitude: p.latitude, longitude: p.longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={[styles.trailDot, { backgroundColor: color }]} />
                  </Marker>
                ))}
                <Marker coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} anchor={{ x: 0.5, y: 1 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.pinLabel}>
                      <Text style={styles.pinName}>{r.id === uid ? 'You' : r.name}</Text>
                      <Text style={styles.pinAgo}>{r.caught ? 'caught' : formatAgo(now - pin.at)}</Text>
                    </View>
                    <Ionicons name="location" size={36} color={color} />
                  </View>
                </Marker>
              </Fragment>
            );
          })}
        </MapView>

        <View style={styles.mapButtons}>
          <MapButton icon="locate" onPress={recenter} label="Center on me" />
          {Object.keys(latestPins).length ? <MapButton icon="scan" onPress={fitToPins} label="Show all pins" /> : null}
        </View>

        {showBanner && bannerText ? (
          <View style={[styles.banner, { borderColor: accent }]}>
            <Ionicons name="location" size={16} color={accent} />
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        ) : null}
        {!coords ? (
          <View style={[styles.banner, { borderColor: colors.graphite }]}>
            <Ionicons name="navigate-outline" size={16} color={colors.muted} />
            <Text style={styles.bannerText}>Waiting for GPS…</Text>
          </View>
        ) : null}
        {!isRunner && phase.phase === 'headstart' ? (
          <View style={styles.waitOverlay} pointerEvents="none">
            <Text style={styles.waitTitle}>STAY PUT</Text>
            <Text style={styles.waitText}>The runners are escaping. Their first location drops when the timer hits zero.</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Runners</Text>
          <Text style={styles.panelCount}>
            {freeRunners.length}/{runners.length} free
          </Text>
        </View>
        <ScrollView style={{ maxHeight: 136 }} contentContainerStyle={{ gap: 6 }}>
          {runners.map((r) => {
            const pin = latestPins[r.id];
            const out = r.caught || r.left;
            let sub = 'No pin yet';
            if (r.left) sub = 'Left the game';
            else if (r.caught) sub = `Caught ${r.caughtAt ? formatClock(r.caughtAt - huntStartAt) + ' into the hunt' : ''}`;
            else if (pin) {
              sub = `Pinned ${formatAgo(now - pin.at)}`;
              if (coords && !isRunner) sub += ` · ${formatDistance(distanceMeters(coords, pin))} away`;
            }
            return (
              <Pressable key={r.id} onPress={() => pin && focusPin(pin)} style={styles.runnerRow}>
                <View style={[styles.dot, { backgroundColor: out ? colors.graphite : colors.runner }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.runnerName, out && { color: colors.muted }]}>
                    {r.id === uid ? `${r.name} (you)` : r.name}
                  </Text>
                  <Text style={styles.runnerSub}>{sub}</Text>
                </View>
                {!isRunner && !out && phase.phase === 'hunt' ? (
                  r.catchClaim ? (
                    <Text style={styles.pending}>Confirming…</Text>
                  ) : (
                    <Pressable onPress={() => tagRunner(r)} style={styles.tagButton}>
                      <Text style={styles.tagText}>CAUGHT</Text>
                    </Pressable>
                  )
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {isRunner && !me.caught ? (
          <Button title="I've been caught" variant="outline" onPress={surrender} style={{ marginTop: 10, height: 44 }} />
        ) : null}
        <Text style={styles.tagline}>
          {isRunner ? (me.caught ? 'Watch your team. Cheer them on.' : 'Stay. Hide. Keep moving.') : 'Find them. Catch them.'}
        </Text>
      </View>

      <Modal visible={!!claim} transparent animationType="fade">
        <View style={styles.claimBackdrop}>
          <View style={styles.claimCard}>
            <MaterialCommunityIcons name="car-sports" size={40} color={colors.orange} />
            <Text style={styles.claimTitle}>{claim?.byName} says they caught you</Text>
            <Text style={styles.claimText}>Be honest — did a hunter tag you?</Text>
            <Button
              title="Yes, I'm caught"
              onPress={() => answerCatchClaim(lobby.code, uid, true, now, claim.by)}
              style={{ alignSelf: 'stretch', marginTop: 20 }}
            />
            <Button
              title="No, I got away"
              variant="outline"
              onPress={() => answerCatchClaim(lobby.code, uid, false, now)}
              style={{ alignSelf: 'stretch', marginTop: 10 }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MapButton({ icon, onPress, label }) {
  return (
    <Pressable onPress={onPress} style={styles.mapButton} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  topSide: { width: 80 },
  youre: { color: colors.sand, fontFamily: fonts.regular, fontSize: 13 },
  role: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: 1 },
  leftLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 2 },
  leftValue: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  timerCard: {
    marginTop: 8,
    minWidth: 170,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 22,
  },
  timerLabel: { color: colors.sand, fontFamily: fonts.regular, fontSize: 12 },
  timerValue: { fontFamily: fonts.semibold, fontSize: 28, fontVariant: ['tabular-nums'] },
  mapWrap: { flex: 1, marginTop: 14, overflow: 'hidden', backgroundColor: colors.panel },
  mapButtons: { position: 'absolute', right: 14, top: 14, gap: 10 },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15,15,15,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    position: 'absolute',
    left: 14,
    right: 70,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: { flex: 1, color: colors.white, fontFamily: fonts.medium, fontSize: 13 },
  waitOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  waitTitle: { color: colors.orange, fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  waitText: { color: colors.sand, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  trailDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.7 },
  pinLabel: {
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    marginBottom: -2,
  },
  pinName: { color: colors.white, fontFamily: fonts.semibold, fontSize: 12 },
  pinAgo: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
  panel: { backgroundColor: colors.black, paddingHorizontal: 20, paddingTop: 14 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  panelTitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
  panelCount: { color: colors.runner, fontFamily: fonts.medium, fontSize: 12 },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  runnerName: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
  runnerSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  pending: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  tagButton: { backgroundColor: colors.orange, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  tagText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  tagline: { color: colors.sand, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginVertical: 12 },
  claimBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  claimCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  claimTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center', marginTop: 12 },
  claimText: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14, marginTop: 6 },
});
