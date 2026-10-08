/**
 * Main Application View for "Depois da Última Aula"
 * Handles lobby, room codes, 2-player capacity, countdown, and game session states.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  HelpCircle,
  Settings,
  Skull,
  Trophy,
  AlertTriangle,
  DoorOpen,
  Volume2,
  Smartphone,
  User,
} from 'lucide-react';
import { multiplayerService } from './services/multiplayer';
import { audioSystem } from './services/audioSystem';
import { GameCanvas } from './game/GameCanvas';
import { HowToPlayModal } from './components/HowToPlayModal';
import { FirebaseModal } from './components/FirebaseModal';
import { RemoteControllerPage } from './components/RemoteControllerPage';
import { TabletPairingModal } from './components/TabletPairingModal';

type AppScreen = 'menu' | 'lobby' | 'game' | 'gameover' | 'victory';

export default function App() {
  // Mobile / Tablet Remote Controller Page route check (works on root domain, GitHub Pages subpaths, or hash/query)
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const isControllerMode =
    urlParams.get('mode') === 'controle' ||
    pathParts.includes('controle') ||
    hash.includes('controle');

  if (isControllerMode) {
    return <RemoteControllerPage />;
  }


  const [screen, setScreen] = useState<AppScreen>('menu');
  const [playerName, setPlayerName] = useState<string>('Aluno ' + Math.floor(10 + Math.random() * 89));
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerIndex, setPlayerIndex] = useState<1 | 2>(1);
  const [isHost, setIsHost] = useState<boolean>(true);
  const [playersInLobby, setPlayersInLobby] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [partnerLeftMessage, setPartnerLeftMessage] = useState<string | null>(null);

  // Modals & Tablet Controller
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState<boolean>(false);
  const [showTabletModal, setShowTabletModal] = useState<boolean>(false);
  const [isTabletConnected, setIsTabletConnected] = useState<boolean>(false);

  // End game stats
  const [gameOverReason, setGameOverReason] = useState<string>('');

  useEffect(() => {
    const onRoomCreated = (data: any) => {
      setRoomCode(data.roomCode);
      setPlayerIndex(1);
      setIsHost(true);
      setPlayersInLobby(1);
      setScreen('lobby');
      setErrorMessage(null);
    };

    const onRoomJoined = (data: any) => {
      setRoomCode(data.roomCode);
      setPlayerIndex(2);
      setIsHost(false);
      setPlayersInLobby(2);
      setScreen('lobby');
      setErrorMessage(null);
    };

    const onPlayerJoined = (data: any) => {
      setPlayersInLobby(data.playersCount || 2);
    };

    const onPlayerLeft = (data: any) => {
      setPlayersInLobby(data.playersCount || 1);
      setPartnerLeftMessage(data.message || 'Seu parceiro saiu da partida.');
    };

    const onCountdownTick = (data: any) => {
      setCountdown(data.countdown);
      audioSystem.playItemPickup();
    };

    const onMatchStarted = () => {
      setCountdown(null);
      setScreen('game');
    };

    const onError = (data: any) => {
      setErrorMessage(data.message);
    };

    const onControlConnected = () => {
      setIsTabletConnected(true);
    };

    const onControlDisconnected = () => {
      setIsTabletConnected(false);
    };

    multiplayerService.on('ROOM_CREATED', onRoomCreated);
    multiplayerService.on('ROOM_JOINED', onRoomJoined);
    multiplayerService.on('PLAYER_JOINED', onPlayerJoined);
    multiplayerService.on('PLAYER_LEFT', onPlayerLeft);
    multiplayerService.on('COUNTDOWN_TICK', onCountdownTick);
    multiplayerService.on('MATCH_STARTED', onMatchStarted);
    multiplayerService.on('CONTROL_CONNECTED', onControlConnected);
    multiplayerService.on('CONTROL_DISCONNECTED', onControlDisconnected);
    multiplayerService.on('ERROR', onError);

    return () => {
      multiplayerService.off('ROOM_CREATED', onRoomCreated);
      multiplayerService.off('ROOM_JOINED', onRoomJoined);
      multiplayerService.off('PLAYER_JOINED', onPlayerJoined);
      multiplayerService.off('PLAYER_LEFT', onPlayerLeft);
      multiplayerService.off('COUNTDOWN_TICK', onCountdownTick);
      multiplayerService.off('MATCH_STARTED', onMatchStarted);
      multiplayerService.off('CONTROL_CONNECTED', onControlConnected);
      multiplayerService.off('CONTROL_DISCONNECTED', onControlDisconnected);
      multiplayerService.off('ERROR', onError);
    };
  }, []);

  const handlePlaySolo = () => {
    setErrorMessage(null);
    setRoomCode('SOLO');
    setPlayerIndex(1);
    setIsHost(true);
    setPlayersInLobby(1);
    multiplayerService.startSoloMode();
    setScreen('game');
  };

  const handleCreateRoom = () => {
    setErrorMessage(null);
    if (!multiplayerService.isConnected) {
      setErrorMessage(
        'Servidor multiplayer desconectado (comum em hospedagens estáticas como GitHub Pages). Use o botão "JOGAR MODO SOLO / TREINO" para jogar agora mesmo sem precisar de servidor!'
      );
      return;
    }
    multiplayerService.createRoom(playerName);
  };

  const handleJoinRoom = () => {
    if (!inputRoomCode.trim()) {
      setErrorMessage('Digite o código da sala de 6 dígitos.');
      return;
    }
    if (!multiplayerService.isConnected) {
      setErrorMessage(
        'Servidor multiplayer desconectado. Para jogar sem servidor na web, utilize o "MODO SOLO / TREINO".'
      );
      return;
    }
    setErrorMessage(null);
    multiplayerService.joinRoom(inputRoomCode.trim().toUpperCase(), playerName);
  };


  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleBackToMenu = () => {
    setScreen('menu');
    setPartnerLeftMessage(null);
    setCountdown(null);
    audioSystem.stopAmbient();
  };

  return (
    <div className="relative w-screen h-screen bg-[#07090e] text-neutral-200 font-mono overflow-hidden flex flex-col justify-between">
      {/* Background Ambience Styling */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-[#07090e] to-[#030508] pointer-events-none" />

      {/* Screen 1: MENU */}
      {screen === 'menu' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full text-center space-y-8">
          {/* Logo & Title */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-red-950/40 border border-red-900/60 px-3 py-1 rounded text-red-400 text-xs tracking-widest font-semibold uppercase">
              <Skull className="w-3.5 h-3.5" /> Jogo de Perseguição e Suspense 2D
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-amber-400 tracking-wider drop-shadow-[0_4px_12px_rgba(245,158,11,0.2)]">
              FUJA DA SOLANGE!!
            </h1>
            <p className="text-xs md:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
              Presos na escola durante a noite. Solange começou na Sala dos Professores e está caçando pelo som dos seus passos!
            </p>
          </div>

          {/* Nickname Input */}
          <div className="w-full max-w-xs space-y-1 text-left">
            <label className="text-[11px] text-neutral-400 uppercase tracking-wider">Seu Apelido</label>
            <input
              type="text"
              value={playerName}
              maxLength={14}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-500 rounded px-3 py-2 text-sm text-amber-300 font-mono outline-none shadow-inner"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="w-full bg-red-950/80 border border-red-700/80 text-red-300 text-xs p-3 rounded flex items-center justify-center gap-2 animate-pulse">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-xs space-y-3">
            {/* Solo / Offline Button */}
            <button
              onClick={handlePlaySolo}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3 rounded text-sm tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-[0.98]"
            >
              <User className="w-4 h-4 fill-black" />
              JOGAR MODO SOLO / TREINO
            </button>

            <button
              onClick={handleCreateRoom}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-2.5 rounded text-xs tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-900/30 active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              CRIAR SALA MULTIPLAYER (2J)
            </button>

            {/* Join Room Form */}
            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="CÓDIGO (EX: K7P2QX)"
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-amber-500 rounded px-3 py-2 text-xs uppercase tracking-widest text-center text-white outline-none"
                />
                <button
                  onClick={handleJoinRoom}
                  className="bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold px-4 py-2 rounded text-xs tracking-wider border border-neutral-700 transition cursor-pointer"
                >
                  ENTRAR
                </button>
              </div>
            </div>
          </div>


          {/* Secondary Buttons (How to play, Firebase & Mobile Controller) */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-3">
            <button
              onClick={() => setShowHowToPlay(true)}
              className="text-neutral-400 hover:text-amber-400 flex items-center gap-1.5 transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              Como Jogar
            </button>
            <span className="text-neutral-700">•</span>
            <button
              onClick={() => setShowFirebaseModal(true)}
              className="text-neutral-400 hover:text-amber-400 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Configuração Firebase
            </button>
            <span className="text-neutral-700">•</span>
            <a
              href="?mode=controle"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition underline cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              Abrir Gamepad do Tablet
            </a>
          </div>
        </div>
      )}

      {/* Screen 2: LOBBY */}
      {screen === 'lobby' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 w-full space-y-6 shadow-2xl">
            <div className="space-y-1">
              <span className="text-[11px] text-amber-500 uppercase tracking-widest font-bold">SALA DE ESPERA</span>
              <h2 className="text-xl font-bold text-white">Código da Partida</h2>
            </div>

            {/* Room Code Display */}
            <div className="flex items-center justify-center gap-3 bg-neutral-900 border border-neutral-700 p-4 rounded-lg">
              <span className="text-3xl font-black text-amber-400 tracking-[0.25em]">
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-2 rounded transition cursor-pointer"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              Envie este código de 6 caracteres para o seu parceiro entrar.
            </p>

            {/* Players Status List (Strictly 2 Max) */}
            <div className="space-y-2 bg-neutral-900/60 p-3 rounded border border-neutral-800 text-xs">
              <div className="flex items-center justify-between text-neutral-400 pb-1 border-b border-neutral-800">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Jogadores Conectados
                </span>
                <span className="font-bold text-amber-300">{playersInLobby} / 2</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-blue-400 font-semibold">● Jogador 1 (Criador)</span>
                <span className="text-emerald-400 text-[11px]">Conectado</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-amber-400 font-semibold">● Jogador 2</span>
                <span className={`text-[11px] ${playersInLobby >= 2 ? 'text-emerald-400' : 'text-neutral-500 animate-pulse'}`}>
                  {playersInLobby >= 2 ? 'Conectado' : 'Aguardando...'}
                </span>
              </div>
            </div>

            {/* Tablet Pairing Option in Lobby */}
            <div className="bg-neutral-900/40 p-3 rounded border border-neutral-800 space-y-2">
              <button
                onClick={() => setShowTabletModal(true)}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer shadow-md ${
                  isTabletConnected
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 hover:bg-emerald-900/80'
                    : 'bg-amber-600/90 hover:bg-amber-500 text-black border-amber-500 shadow-amber-900/40 active:scale-[0.98]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>
                  {isTabletConnected
                    ? `🎮 TABLET CONECTADO (JOGADOR ${playerIndex})`
                    : 'CONTROLAR PELO TABLET'}
                </span>
              </button>
              <p className="text-[10px] text-neutral-400 text-center">
                Use o celular ou tablet como controle remoto na mesma partida.
              </p>
            </div>

            {/* Countdown or Waiting Notice */}
            {countdown !== null ? (
              <div className="bg-amber-950/60 border border-amber-600/70 p-4 rounded-lg space-y-1 animate-pulse">
                <span className="text-xs text-amber-300 font-bold block uppercase tracking-wider">
                  Os dois jogadores estão prontos!
                </span>
                <div className="text-4xl font-black text-amber-400">
                  {countdown}
                </div>
                <span className="text-[11px] text-neutral-400">Iniciando a partida na escola...</span>
              </div>
            ) : (
              <div className="text-xs text-neutral-400 italic">
                Esperando o segundo jogador entrar para iniciar...
              </div>
            )}

            {partnerLeftMessage && (
              <div className="text-xs bg-red-950/70 border border-red-700 p-2.5 rounded text-red-300">
                ⚠️ {partnerLeftMessage}
              </div>
            )}

            <button
              onClick={handleBackToMenu}
              className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Sair da Sala
            </button>
          </div>
        </div>
      )}

      {/* Screen 3: GAME CANVAS */}
      {screen === 'game' && (
        <GameCanvas
          playerIndex={playerIndex}
          playerName={playerName}
          isHost={isHost}
          onExitToMenu={handleBackToMenu}
          onGameOver={(reason) => {
            setGameOverReason(reason);
            setScreen('gameover');
            audioSystem.stopAmbient();
          }}
          onVictory={() => {
            setScreen('victory');
            audioSystem.stopAmbient();
          }}
        />
      )}

      {/* Screen 4: GAME OVER (DEFEAT) */}
      {screen === 'gameover' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
          <div className="bg-black/90 border border-red-900 rounded-lg p-8 w-full space-y-6 shadow-2xl">
            <Skull className="w-16 h-16 text-red-600 mx-auto animate-bounce" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-red-500 tracking-wider">DERROTA</h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {gameOverReason || 'Solange alcançou vocês no escuro dos corredores.'}
              </p>
            </div>
            <div className="text-xs text-neutral-500 border-t border-neutral-800 pt-4">
              Lembre-se: andar silenciosamente evita atrair Solange. Esconda-se em armários quando ouvir passos pesados!
            </div>
            <button
              onClick={handleBackToMenu}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded text-xs tracking-wider transition cursor-pointer"
            >
              VOLTAR AO MENU PRINCIPAL
            </button>
          </div>
        </div>
      )}

      {/* Screen 5: VICTORY */}
      {screen === 'victory' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
          <div className="bg-black/90 border border-emerald-900 rounded-lg p-8 w-full space-y-6 shadow-2xl">
            <Trophy className="w-16 h-16 text-emerald-400 mx-auto animate-pulse" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-emerald-400 tracking-wider">VOCÊS ESCAPARAM!</h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Vocês completaram as tarefas na escola e abriram o portão principal a tempo! Solange ficou para trás na escuridão.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-500/80 bg-emerald-950/40 p-3 rounded border border-emerald-800/40">
              <DoorOpen className="w-4 h-4" />
              <span>Trabalho em equipe impecável.</span>
            </div>
            <button
              onClick={handleBackToMenu}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold py-3 rounded text-xs tracking-wider transition cursor-pointer"
            >
              JOGAR NOVAMENTE
            </button>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="relative z-10 text-center py-3 text-[11px] text-neutral-500 border-t border-neutral-900/80">
        <span>FUJA DA SOLANGE!! • Pixel Art Horror 2D Multiplayer • 2 Jogadores</span>
      </footer>

      {/* Modals */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showFirebaseModal && <FirebaseModal onClose={() => setShowFirebaseModal(false)} />}
      {showTabletModal && (
        <TabletPairingModal
          playerIndex={playerIndex}
          onClose={() => setShowTabletModal(false)}
        />
      )}
    </div>
  );
}
