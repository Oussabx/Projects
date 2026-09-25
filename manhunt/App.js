import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { isFirebaseConfigured, loadUsername, watchUser } from './src/firebase';
import { leaveLobby, measureClockOffset } from './src/game/api';
import { useLobby } from './src/hooks/useLobby';
import { useNow } from './src/hooks/useNow';
import { Loading } from './src/components/ui';
import { SetupScreen } from './src/screens/SetupScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { GetReadyScreen } from './src/screens/GetReadyScreen';
import { GameScreen } from './src/screens/GameScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';

const SESSION_KEY = 'manhunt.session';

export default function App() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!fontsLoaded ? null : isFirebaseConfigured ? <Root /> : <SetupScreen />}
    </SafeAreaProvider>
  );
}

function Root() {
  const [auth, setAuth] = useState({ resolved: false, user: null });
  const [username, setUsername] = useState(null);
  const [session, setSession] = useState({ loaded: false, code: null });
  const [offset, setOffset] = useState(0);
  const user = auth.user;

  useEffect(() => watchUser((u) => setAuth({ resolved: true, user: u })), []);

  // The public username lives on the Firebase profile (and users/{uid} as a fallback).
  useEffect(() => {
    setUsername(user?.displayName || null);
    if (user && !user.displayName) {
      loadUsername(user.uid).then((n) => setUsername((cur) => cur || n || user.email?.split('@')[0] || 'Player'));
    }
  }, [user]);

  // Remember the current lobby per account so a crash or restart drops you back into the game.
  useEffect(() => {
    if (!user) return;
    setSession({ loaded: false, code: null });
    AsyncStorage.getItem(`${SESSION_KEY}.${user.uid}`)
      .then((raw) => setSession({ loaded: true, code: raw ? JSON.parse(raw).code : null }))
      .catch(() => setSession({ loaded: true, code: null }));
    measureClockOffset(user.uid).then(setOffset).catch(() => {});
  }, [user]);

  function saveCode(code) {
    setSession({ loaded: true, code });
    AsyncStorage.setItem(`${SESSION_KEY}.${user.uid}`, JSON.stringify({ code })).catch(() => {});
  }

  if (!auth.resolved) return <Loading label="Connecting" />;
  if (!user) return <AuthScreen onSignedUp={(u) => setUsername(u?.displayName || null)} />;
  if (!session.loaded || !username) return <Loading label="Loading profile" />;

  if (!session.code) {
    return <HomeScreen uid={user.uid} name={username} onEnterLobby={saveCode} />;
  }

  return (
    <GameRouter
      key={session.code}
      code={session.code}
      uid={user.uid}
      offset={offset}
      onExit={() => saveCode(null)}
    />
  );
}

// Everyone's screen follows the shared lobby document: lobby → get ready → game → results.
function GameRouter({ code, uid, offset, onExit }) {
  const { loading, lobby, error } = useLobby(code);
  const now = useNow(offset, 250);
  const me = lobby?.players?.[uid];
  const playing = lobby?.status === 'playing';
  const leaving = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (error || !lobby || !me || me.left) {
      if (leaving.current) return;
      if (error) Alert.alert('Lobby unavailable', error.message);
      else if (!lobby) Alert.alert('Lobby closed', 'This lobby no longer exists.');
      else if (!me) Alert.alert('Removed', 'You are no longer in this lobby.');
      onExit();
    }
  }, [loading, lobby, me, error]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phones must stay awake during a game so pins keep flowing.
  useEffect(() => {
    if (!playing) return undefined;
    activateKeepAwakeAsync('manhunt').catch(() => {});
    return () => deactivateKeepAwake('manhunt');
  }, [playing]);

  async function leave() {
    leaving.current = true;
    try {
      await leaveLobby(code, uid);
    } finally {
      onExit();
    }
  }

  if (loading || !lobby || !me) return <Loading label="Joining lobby" />;

  if (lobby.status === 'lobby') return <LobbyScreen lobby={lobby} uid={uid} now={now} onLeave={leave} />;
  if (lobby.status === 'ended') return <ResultsScreen lobby={lobby} uid={uid} onLeave={leave} />;
  if (now < lobby.startAt) return <GetReadyScreen lobby={lobby} me={{ id: uid, ...me }} now={now} />;
  return <GameScreen lobby={lobby} uid={uid} now={now} offset={offset} onLeave={leave} />;
}
