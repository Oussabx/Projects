import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Eyebrow, Pill, RoundIcon } from '../components/ui';
import { Breathe, PulseRings } from '../components/fx';
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
import { colors, fonts, roleColor, roleGradient } from '../theme';

const BANNER_MS = 20000;

export function GameScreen({ lobby, uid, now, offset, onLeave }) {
  const me = { id: uid, ...lobby.players[uid] };
  const isRunner = me.role === 'runner';
  const accent = roleColor(me.role);
  const phase = getPhase(lobby, now);
  const { startAt, huntStartAt, endAt, pingMs } = timeline(lobby);
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
  let progress = 0;
  if (isRunner && me.caught) {
    timerLabel = 'You were caught';
    timerValue = 'OUT';
  } else if (phase.phase === 'headstart') {
    timerLabel = isRunner ? 'Head start' : 'First location in';
    timerValue = formatClock(phase.remaining);
    progress = 1 - phase.remaining / (huntStartAt - startAt);
  } else if (phase.nextPingAt) {
    const ms = phase.nextPingAt - now;
    timerLabel = isRunner ? 'Next pin drop in' : 'Next location in';
    timerValue = formatClock(ms);
    warn = isRunner && ms <= 30000;
    progress = 1 - ms / pingMs;
  } else {
    timerLabel = isRunner ? 'Survive for' : 'Last chance';
    timerValue = formatClock(phase.remaining);
    progress = 1 - phase.remaining / (endAt - huntStartAt);
  }

  const roundStartedAt = phase.phase === 'hunt' ? huntStartAt + phase.round * pingMs : null;
  const showBanner = roundStartedAt && now - roundStartedAt < BANNER_MS;
  const bannerText = isRunner
    ? me.caught
      ? null
      : 'Your location was just sent to the hunters. Move!'
    : `${phase.round === 0 ? 'First' : 'New'} location pins dropped`;

  const claim = isRunner && !me.caught ? me.catchClaim : null;
  const grad = roleGradient(me.role);
  const timerColor = warn ? colors.orange : accent;

  return (
    <View style={styles.root}>
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
        mapPadding={{ top: 230, bottom: 260, left: 0, right: 0 }}
      >
        {runners.map((r) => {
          const trail = trails[r.id] || [];
          const pin = latestPins[r.id];
          if (!pin) return null;
          const out = r.caught || r.left;
          const color = out ? colors.graphite : isRunner ? colors.runner : colors.orange;
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
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.trailDot, { borderColor: color }]} />
                </Marker>
              ))}
              <Marker coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} anchor={{ x: 0.5, y: 1 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.pinLabel, { borderColor: color }]}>
                    <Text style={styles.pinName}>{r.id === uid ? 'You' : r.name}</Text>
                    <Text style={[styles.pinAgo, { color }]}>{out ? 'CAUGHT' : formatAgo(now - pin.at).toUpperCase()}</Text>
                  </View>
                  <View style={[styles.pinStem, { backgroundColor: color }]} />
                  <View style={[styles.pinHalo, { borderColor: color, backgroundColor: color + '33' }]}>
                    <View style={[styles.pinCore, { backgroundColor: color }]} />
                  </View>
                </View>
              </Marker>
            </Fragment>
          );
        })}
      </MapView>

      <LinearGradient colors={['rgba(11,11,11,0.95)', 'rgba(11,11,11,0)']} style={[styles.fadeTop, { height: insets.top + 230 }]} pointerEvents="none" />
      <LinearGradient colors={['rgba(11,11,11,0)', 'rgba(11,11,11,0.9)']} style={styles.fadeBottom} pointerEvents="none" />

      {/* HUD */}
      <View style={[styles.hud, { top: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.hudRow} pointerEvents="box-none">
          <RoundIcon name="menu" onPress={openMenu} label="Game menu" />
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rolePill}>
            <MaterialCommunityIcons name={isRunner ? 'run-fast' : 'car-sports'} size={18} color={colors.white} />
            <Text style={styles.roleText}>{isRunner ? 'RUNNER' : 'HUNTER'}</Text>
          </LinearGradient>
          <View style={styles.clockPill}>
            <Ionicons name="hourglass-outline" size={13} color={colors.sand} />
            <Text style={styles.clockText}>{formatClock(phase.endAt - now)}</Text>
          </View>
        </View>

        <View style={[styles.timerCard, warn && { borderColor: colors.orange }]}>
          <Eyebrow style={{ color: warn ? colors.orange : colors.sand, fontSize: 10 }}>{timerLabel}</Eyebrow>
          <Breathe amount={warn ? 0.07 : 0} duration={warn ? 400 : 100000}>
            <Text style={[styles.timerValue, { color: timerColor, textShadowColor: timerColor }]}>{timerValue}</Text>
          </Breathe>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={warn ? [colors.orange, colors.orangeDeep] : grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]}
            />
          </View>
        </View>

        {showBanner && bannerText ? (
          <View style={[styles.banner, { borderColor: accent }]}>
            <View style={[styles.bannerIcon, { backgroundColor: accent }]}>
              <Ionicons name="location" size={14} color={colors.black} />
            </View>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        ) : null}
        {!coords ? (
          <View style={[styles.banner, { borderColor: colors.graphite }]}>
            <Ionicons name="navigate-outline" size={16} color={colors.muted} />
            <Text style={styles.bannerText}>Waiting for GPS…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapButtons}>
        <RoundIcon name="locate" onPress={recenter} label="Center on me" size={46} />
        {Object.keys(latestPins).length ? <RoundIcon name="scan" onPress={fitToPins} label="Show all pins" size={46} /> : null}
      </View>

      {!isRunner && phase.phase === 'headstart' ? (
        <View style={styles.waitWrap} pointerEvents="none">
          <View style={styles.waitRings}>
            <PulseRings color={colors.orange} size={200} />
            <LinearGradient colors={grad} style={styles.waitIcon}>
              <MaterialCommunityIcons name="car-sports" size={30} color={colors.white} />
            </LinearGradient>
          </View>
          <Text style={styles.waitTitle}>STAY PUT</Text>
          <Text style={styles.waitText}>The runners are escaping.{'\n'}Their first location drops when the timer hits zero.</Text>
        </View>
      ) : null}

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Eyebrow>Runners</Eyebrow>
          <Pill
            icon="walk"
            label={`${freeRunners.length}/${runners.length} FREE`}
            color={colors.runner}
            bg={colors.runnerDim}
          />
        </View>
        <ScrollView style={{ maxHeight: 150 }} contentContainerStyle={{ gap: 8 }}>
          {runners.map((r) => {
            const pin = latestPins[r.id];
            const out = r.caught || r.left;
            let sub = 'No pin yet';
            if (r.left) sub = 'Left the game';
            else if (r.caught) sub = `Caught${r.caughtAt ? ' at ' + formatClock(Math.max(0, r.caughtAt - huntStartAt)) : ''}`;
            else if (pin) {
              sub = `Pinned ${formatAgo(now - pin.at)}`;
              if (coords && !isRunner) sub += ` · ${formatDistance(distanceMeters(coords, pin))} away`;
            }
            return (
              <Pressable key={r.id} onPress={() => pin && focusPin(pin)} style={[styles.runnerRow, out && { opacity: 0.55 }]}>
                <Avatar name={r.name} size={34} ring={out ? colors.graphite : colors.runner} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.runnerName}>{r.id === uid ? `${r.name} (you)` : r.name}</Text>
                  <Text style={styles.runnerSub}>{sub}</Text>
                </View>
                {!isRunner && !out && phase.phase === 'hunt' ? (
                  r.catchClaim ? (
                    <Pill icon="time-outline" label="CONFIRMING" color={colors.muted} />
                  ) : (
                    <Pressable onPress={() => tagRunner(r)}>
                      <LinearGradient colors={[colors.orange, colors.orangeDeep]} style={styles.tagButton}>
                        <MaterialCommunityIcons name="hand-back-right" size={14} color={colors.white} />
                        <Text style={styles.tagText}>CAUGHT</Text>
                      </LinearGradient>
                    </Pressable>
                  )
                ) : out ? (
                  <MaterialCommunityIcons name="handcuffs" size={20} color={colors.muted} />
                ) : pin ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.graphite} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {isRunner && !me.caught ? (
          <Button
            title="I've been caught"
            icon="hand-left-outline"
            variant="outline"
            onPress={surrender}
            height={46}
            style={{ marginTop: 12 }}
          />
        ) : null}
        <Text style={styles.tagline}>
          {isRunner ? (me.caught ? 'Watch your team. Cheer them on.' : 'Stay. Hide. Keep moving.') : 'Find them. Catch them.'}
        </Text>
      </View>

      <Modal visible={!!claim} transparent animationType="fade">
        <View style={styles.claimBackdrop}>
          <View style={styles.claimCard}>
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <PulseRings color={colors.orange} size={160} duration={1400} />
              <LinearGradient colors={[colors.orange, colors.orangeDeep]} style={styles.claimIcon}>
                <MaterialCommunityIcons name="handcuffs" size={34} color={colors.white} />
              </LinearGradient>
            </View>
            <Text style={styles.claimTitle}>{claim?.byName?.toUpperCase()} SAYS{'\n'}THEY CAUGHT YOU</Text>
            <Text style={styles.claimText}>Be honest — did a hunter tag you?</Text>
            <Button
              title="Yes, I'm caught"
              onPress={() => answerCatchClaim(lobby.code, uid, true, now, claim.by)}
              style={{ alignSelf: 'stretch', marginTop: 22 }}
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
    </View>
  );
}

const glass = {
  backgroundColor: colors.glass,
  borderWidth: 1,
  borderColor: colors.borderSoft,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },
  hud: { position: 'absolute', left: 16, right: 16, gap: 10 },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
  },
  roleText: { color: colors.white, fontFamily: fonts.display, fontSize: 18, letterSpacing: 2 },
  clockPill: { ...glass, flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 12, borderRadius: 21 },
  clockText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  timerCard: { ...glass, borderRadius: 20, alignItems: 'center', paddingTop: 12, paddingBottom: 14, paddingHorizontal: 20 },
  timerValue: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    textShadowRadius: 22,
    textShadowOffset: { width: 0, height: 0 },
  },
  progressTrack: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  banner: {
    ...glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  mapButtons: { position: 'absolute', right: 16, bottom: 330, gap: 10 },
  waitWrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  waitRings: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  waitIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: colors.orange, fontFamily: fonts.display, fontSize: 30, letterSpacing: 3, marginTop: -16 },
  waitText: { color: colors.sand, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  trailDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: colors.black },
  pinLabel: {
    backgroundColor: 'rgba(11,11,11,0.94)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  pinName: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  pinAgo: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  pinStem: { width: 2, height: 10 },
  pinHalo: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinCore: { width: 10, height: 10, borderRadius: 5 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,16,16,0.97)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.graphite, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  runnerName: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
  runnerSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  tagButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  tagText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  tagline: { color: colors.graphite, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2.5, textAlign: 'center', marginTop: 12, textTransform: 'uppercase' },
  claimBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  claimCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,75,43,0.4)',
    padding: 24,
    alignItems: 'center',
  },
  claimIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  claimTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, textAlign: 'center', letterSpacing: 1, marginTop: 4 },
  claimText: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14, marginTop: 8 },
});
