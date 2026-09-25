import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Eyebrow, Header, Pill, RoundIcon, Screen } from '../components/ui';
import { CodeBoxes } from '../components/CodeBoxes';
import { FadeIn, Glow } from '../components/fx';
import { kickPlayer, startGame, updateSettings } from '../game/api';
import {
  DURATION_OPTIONS,
  HEAD_START_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PING_OPTIONS,
  playerList,
  teamSizes,
} from '../game/logic';
import { colors, fonts } from '../theme';

export function LobbyScreen({ lobby, uid, now, onLeave }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const players = playerList(lobby);
  const isHost = lobby.hostId === uid;
  const s = lobby.settings;
  const missingLocation = players.filter((p) => !p.locationOk);
  const canStart = players.length >= MIN_PLAYERS && !missingLocation.length;
  const teams = teamSizes(Math.max(players.length, MIN_PLAYERS));

  function confirmLeave() {
    Alert.alert('Leave lobby?', isHost ? 'Another player will become the host.' : undefined, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ]);
  }

  function invite() {
    Share.share({
      message: `Join my MANHUNT game! Open the Manhunt app, tap "Join Lobby" and enter code ${lobby.code}`,
    });
  }

  function onPlayerPress(p) {
    if (!isHost || p.id === uid) return;
    Alert.alert(`Remove ${p.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => kickPlayer(lobby.code, p.id) },
    ]);
  }

  async function handleStart() {
    setStarting(true);
    try {
      await startGame(lobby.code, now);
    } catch (e) {
      Alert.alert('Cannot start yet', e.message);
    } finally {
      setStarting(false);
    }
  }

  function footerHint() {
    if (players.length < MIN_PLAYERS) return 'Need at least 2 players';
    if (missingLocation.length) return `Waiting for ${missingLocation[0].name} to turn on location`;
    return isHost ? 'Ready when you are. Roles are random.' : 'Waiting for the host to start…';
  }

  return (
    <Screen edges={['top']}>
      <Glow size={width * 1.3} opacity={0.22} style={{ top: -width * 0.6, left: -width * 0.15 }} />
      <Header
        eyebrow="Game lobby"
        title="LOBBY"
        onBack={confirmLeave}
        right={isHost ? <RoundIcon name="options-outline" label="Game settings" onPress={() => setSettingsOpen(true)} /> : null}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <FadeIn>
          <CodeBoxes value={lobby.code} size={50} />
          <Pressable onPress={invite} style={styles.invite}>
            <Ionicons name="share-social" size={15} color={colors.orange} />
            <Text style={styles.inviteText}>Invite friends</Text>
          </Pressable>
        </FadeIn>

        <FadeIn delay={80}>
          <Card style={styles.matchup}>
            <View style={styles.side}>
              <MaterialCommunityIcons name="car-sports" size={28} color={colors.orange} />
              <Text style={[styles.sideCount, { color: colors.orange }]}>{teams.hunters}</Text>
              <Text style={styles.sideLabel}>HUNTERS</Text>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={styles.side}>
              <MaterialCommunityIcons name="run-fast" size={28} color={colors.runner} />
              <Text style={[styles.sideCount, { color: colors.runner }]}>{teams.runners}</Text>
              <Text style={styles.sideLabel}>RUNNERS</Text>
            </View>
          </Card>
          <View style={styles.pills}>
            <Pill icon="timer-outline" label={`${s.headStartMin} MIN HEAD START`} />
            <Pill icon="hourglass-outline" label={`${s.durationMin} MIN HUNT`} />
            <Pill icon="location-outline" label={`PIN / ${s.pingIntervalMin} MIN`} />
          </View>
        </FadeIn>

        <View style={styles.listHead}>
          <Eyebrow>Players</Eyebrow>
          <Text style={styles.count}>
            {players.length}
            <Text style={{ color: colors.graphite }}>/{MAX_PLAYERS}</Text>
          </Text>
        </View>
        <View style={styles.segments}>
          {Array.from({ length: MAX_PLAYERS }).map((_, i) => (
            <View key={i} style={[styles.segment, i < players.length && styles.segmentOn]} />
          ))}
        </View>

        {players.map((p, i) => (
          <FadeIn key={p.id} delay={120 + i * 60}>
            <Pressable onLongPress={() => onPlayerPress(p)}>
              <Card style={styles.row} glow={p.id === uid ? 'rgba(255,75,43,0.45)' : undefined}>
                <Avatar name={p.name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                    {p.id === uid ? <Text style={styles.you}>  YOU</Text> : null}
                  </Text>
                  <Text style={[styles.status, { color: p.locationOk ? colors.runner : colors.orange }]}>
                    {p.locationOk ? '● GPS ready' : '● Location off'}
                  </Text>
                </View>
                {p.id === lobby.hostId ? (
                  <Pill icon="star" label="HOST" color={colors.orange} bg={colors.orangeDim} />
                ) : null}
              </Card>
            </Pressable>
          </FadeIn>
        ))}
        {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }).map((_, i) => (
          <Pressable key={`empty-${i}`} onPress={invite} style={styles.emptyRow}>
            <View style={styles.emptyAvatar}>
              <Ionicons name="add" size={18} color={colors.graphite} />
            </View>
            <Text style={styles.emptyText}>Open slot — tap to invite</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <LinearGradient colors={['rgba(11,11,11,0)', colors.black]} style={styles.fade} pointerEvents="none" />
        <Text style={styles.hint}>{footerHint()}</Text>
        {isHost ? (
          <Button title="Start Game" icon="flash" onPress={handleStart} disabled={!canStart} loading={starting} />
        ) : (
          <View style={styles.waiting}>
            <MaterialCommunityIcons name="timer-sand" size={16} color={colors.muted} />
            <Text style={styles.waitingText}>Host starts the game</Text>
          </View>
        )}
      </View>

      <SettingsSheet
        visible={settingsOpen}
        settings={s}
        onClose={() => setSettingsOpen(false)}
        onChange={(next) => updateSettings(lobby.code, { ...s, ...next })}
      />
    </Screen>
  );
}

function SettingsSheet({ visible, settings, onClose, onChange }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>GAME SETTINGS</Text>
        <OptionRow
          icon="timer-outline"
          label="Runner head start"
          options={HEAD_START_OPTIONS}
          value={settings.headStartMin}
          onSelect={(v) => onChange({ headStartMin: v })}
        />
        <OptionRow
          icon="hourglass-outline"
          label="Hunt duration"
          options={DURATION_OPTIONS}
          value={settings.durationMin}
          onSelect={(v) => onChange({ durationMin: v })}
        />
        <OptionRow
          icon="location-outline"
          label="Location pin every"
          options={PING_OPTIONS}
          value={settings.pingIntervalMin}
          onSelect={(v) => onChange({ pingIntervalMin: v })}
        />
        <Button title="Done" onPress={onClose} style={{ marginTop: 8 }} />
      </View>
    </Modal>
  );
}

function OptionRow({ icon, label, options, value, onSelect }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ionicons name={icon} size={14} color={colors.orange} />
        <Eyebrow>{label}</Eyebrow>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Chip key={o} label={`${o} MIN`} selected={o === value} onPress={() => onSelect(o)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 150, gap: 10 },
  invite: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.orangeDim,
  },
  inviteText: { color: colors.orange, fontFamily: fonts.semibold, fontSize: 13 },
  matchup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 16, marginTop: 10 },
  side: { alignItems: 'center', gap: 2, width: 100 },
  sideCount: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48 },
  sideLabel: { color: colors.sand, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2.5 },
  vs: { color: colors.graphite, fontFamily: fonts.display, fontSize: 26, letterSpacing: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 10 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 },
  count: { color: colors.white, fontFamily: fonts.display, fontSize: 20 },
  segments: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  segmentOn: { backgroundColor: colors.orange },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  name: { color: colors.white, fontFamily: fonts.semibold, fontSize: 16 },
  you: { color: colors.orange, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.5 },
  status: { fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.graphite, fontFamily: fonts.medium, fontSize: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, backgroundColor: colors.black },
  fade: { position: 'absolute', left: 0, right: 0, top: -40, height: 40 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginBottom: 10, marginTop: 6 },
  waiting: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  waitingText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.graphite, marginBottom: 18 },
  sheetTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 22, letterSpacing: 1.5, marginBottom: 20 },
});
