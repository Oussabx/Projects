import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Eyebrow, Header, IconButton, Screen } from '../components/ui';
import { kickPlayer, startGame, updateSettings } from '../game/api';
import {
  DURATION_OPTIONS,
  HEAD_START_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PING_OPTIONS,
  modeLabel,
  playerList,
} from '../game/logic';
import { colors, fonts } from '../theme';

export function LobbyScreen({ lobby, uid, now, onLeave }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const players = playerList(lobby);
  const isHost = lobby.hostId === uid;
  const s = lobby.settings;
  const missingLocation = players.filter((p) => !p.locationOk);
  const canStart = players.length >= MIN_PLAYERS && !missingLocation.length;

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
    if (players.length < MIN_PLAYERS) return 'Waiting for players…';
    if (missingLocation.length) return `Waiting for ${missingLocation[0].name} to turn on location…`;
    return isHost ? 'Roles are assigned at random.' : 'Waiting for host…';
  }

  return (
    <Screen>
      <Header
        title="Lobby"
        onBack={confirmLeave}
        right={isHost ? <IconButton name="settings-outline" label="Game settings" onPress={() => setSettingsOpen(true)} /> : null}
      />

      <View style={styles.codeBlock}>
        <Text style={styles.codeLabel}>Lobby Code</Text>
        <Pressable onPress={invite} style={styles.codeRow} accessibilityLabel="Share lobby code">
          <Text style={styles.code}>{lobby.code}</Text>
          <Ionicons name="share-outline" size={20} color={colors.orange} />
        </Pressable>
        <View style={styles.badges}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>{modeLabel(players.length)}</Text>
          </View>
          <Text style={styles.settingsSummary}>
            {s.headStartMin} min head start · {s.durationMin} min hunt · pin every {s.pingIntervalMin} min
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        {players.map((p) => (
          <Pressable key={p.id} onLongPress={() => onPlayerPress(p)} style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={14} color={colors.sand} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {p.id === uid ? 'You' : p.name}
              {p.id === uid ? <Text style={styles.youName}>{`  ${p.name}`}</Text> : null}
            </Text>
            {p.id === lobby.hostId ? <Text style={styles.hostTag}>HOST</Text> : null}
            <Ionicons
              name={p.locationOk ? 'location' : 'location-outline'}
              size={16}
              color={p.locationOk ? colors.runner : colors.orange}
            />
          </Pressable>
        ))}
        {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }).map((_, i) => (
          <Pressable key={`empty-${i}`} onPress={invite} style={[styles.row, styles.emptyRow]}>
            <View style={[styles.avatar, { borderStyle: 'dashed' }]}>
              <Ionicons name="add" size={14} color={colors.graphite} />
            </View>
            <Text style={styles.emptyText}>Invite a player</Text>
          </Pressable>
        ))}
        <Text style={styles.teamsNote}>
          1 vs 1 up to 3 vs 3. Hunters drive, runners go on foot. Every phone needs Manhunt open with location on.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.count}>
          {players.length}/{MAX_PLAYERS}
        </Text>
        <Text style={styles.hint}>{footerHint()}</Text>
        {isHost ? (
          <Button title="Start Game" onPress={handleStart} disabled={!canStart} loading={starting} style={{ marginTop: 14, alignSelf: 'stretch' }} />
        ) : null}
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
        <Text style={styles.sheetTitle}>Game settings</Text>
        <OptionRow
          label="Runner head start"
          options={HEAD_START_OPTIONS}
          value={settings.headStartMin}
          onSelect={(v) => onChange({ headStartMin: v })}
        />
        <OptionRow
          label="Hunt duration"
          options={DURATION_OPTIONS}
          value={settings.durationMin}
          onSelect={(v) => onChange({ durationMin: v })}
        />
        <OptionRow
          label="Location pin every"
          options={PING_OPTIONS}
          value={settings.pingIntervalMin}
          onSelect={(v) => onChange({ pingIntervalMin: v })}
        />
        <Button title="Done" onPress={onClose} style={{ marginTop: 12 }} />
      </View>
    </Modal>
  );
}

function OptionRow({ label, options, value, onSelect }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Eyebrow style={{ marginBottom: 10 }}>{label}</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Chip key={o} label={`${o} MIN`} selected={o === value} onPress={() => onSelect(o)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  codeBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 18 },
  codeLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  code: { color: colors.white, fontFamily: fonts.semibold, fontSize: 34, letterSpacing: 4 },
  badges: { alignItems: 'center', gap: 8, marginTop: 10 },
  modeBadge: { borderWidth: 1, borderColor: colors.orange, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3 },
  modeText: { color: colors.orange, fontFamily: fonts.display, fontSize: 14, letterSpacing: 2 },
  settingsSummary: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  list: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  row: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, color: colors.white, fontFamily: fonts.medium, fontSize: 15 },
  youName: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  hostTag: { color: colors.orange, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2 },
  emptyRow: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  emptyText: { color: colors.graphite, fontFamily: fonts.regular, fontSize: 14 },
  teamsNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, alignItems: 'center' },
  count: { color: colors.white, fontFamily: fonts.medium, fontSize: 18 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 18, marginBottom: 20 },
});
