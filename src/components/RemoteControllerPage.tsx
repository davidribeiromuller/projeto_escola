/**
 * Remote Virtual Gamepad Page for Tablets & Phones
 * 
 * Features:
 * - Touch-action: none, 100% viewport, no pinch-zoom, no scroll
 * - Responsive in both portrait and landscape
 * - Large Analog Virtual Joystick with Pointer Events (-1 to +1 normalized)
 * - Immediate stop when joystick is released
 * - Continuous hold [CORRER] sprint button
 * - Instant [INTERAGIR] (Key E) button and [ESCONDER] button
 * - Auto-connect via URL query `?code=XXXXXX`
 * - Throttled 25-30 Hz input transmission
 */

import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Wifi, WifiOff, Zap, Hand, Maximize2, ShieldAlert, DoorClosed, AlertTriangle } from 'lucide-react';
import { multiplayerService } from '../services/multiplayer';

export const RemoteControllerPage: React.FC = () => {
  // Query param or path parsing for auto-connection (e.g. /controle/7K4P9X, ?code=7K4P9X or ?mode=controle&code=7K4P9X)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, '?'));
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const ctrlIdx = pathParts.indexOf('controle');
  const pathCode = ctrlIdx !== -1 && pathParts[ctrlIdx + 1] ? pathParts[ctrlIdx + 1] : '';
  const initialCode = (urlParams.get('code') || hashParams.get('code') || pathCode || '').toUpperCase().trim();


  const [code, setCode] = useState<string>(initialCode);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string>('Desconectado');
  const [playerIndex, setPlayerIndex] = useState<1 | 2 | null>(null);

  // Companion Game Telemetry
  const [telemetry, setTelemetry] = useState<{
    stamina: number;
    isHiding: boolean;
    isDowned: boolean;
    heldItem: string | null;
    noiseLevel: number;
    zone: string;
  }>({
    stamina: 100,
    isHiding: false,
    isDowned: false,
    heldItem: null,
    noiseLevel: 0,
    zone: '',
  });

  // Haptic Feedback Helper
  const triggerHaptic = (pattern: number | number[] = 25) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        // ignore on unsupported devices
      }
    }
  };

  // Joystick & Button Input State
  const inputRef = useRef({
    dx: 0,
    dy: 0,
    run: false,
    interact: false,
    hide: false,
  });

  // Joystick touch tracking refs
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  // Connect handler
  const handleConnect = (targetCode?: string) => {
    const c = (targetCode || code).trim().toUpperCase();
    if (!c) return;
    setConnectionMessage('Conectando ao jogo...');
    multiplayerService.connectAsController(c);
  };

  useEffect(() => {
    const onConnected = (data: any) => {
      setIsConnected(true);
      setPlayerIndex(data.playerIndex);
      setConnectionMessage(data.message || `Conectado ao Jogador ${data.playerIndex}`);
      triggerHaptic([40, 60, 40]);
    };

    const onDisconnected = () => {
      setIsConnected(false);
      setConnectionMessage('Controle desconectado. Tentando reconectar...');
      triggerHaptic([100, 50, 100]);
    };

    const onError = (data: any) => {
      setConnectionMessage(`Erro: ${data.message}`);
    };

    const onTelemetry = (data: any) => {
      setTelemetry({
        stamina: data.stamina ?? 100,
        isHiding: Boolean(data.isHiding),
        isDowned: Boolean(data.isDowned),
        heldItem: data.heldItem || null,
        noiseLevel: data.noiseLevel ?? 0,
        zone: data.zone || '',
      });

      if (data.isDowned) {
        triggerHaptic([150, 80, 150]);
      }
    };

    multiplayerService.on('CONTROL_CONNECTED', onConnected);
    multiplayerService.on('CONTROL_DISCONNECTED', onDisconnected);
    multiplayerService.on('CONTROLLER_TELEMETRY', onTelemetry);
    multiplayerService.on('ERROR', onError);

    // Auto-connect if code exists in URL
    if (initialCode) {
      setTimeout(() => handleConnect(initialCode), 300);
    }

    return () => {
      multiplayerService.off('CONTROL_CONNECTED', onConnected);
      multiplayerService.off('CONTROL_DISCONNECTED', onDisconnected);
      multiplayerService.off('CONTROLLER_TELEMETRY', onTelemetry);
      multiplayerService.off('ERROR', onError);
    };
  }, [initialCode]);

  // Transmit inputs to server at 30 Hz
  useEffect(() => {
    if (!isConnected) return;

    let lastSent = { dx: 0, dy: 0, run: false, interact: false, hide: false };

    const interval = setInterval(() => {
      const cur = inputRef.current;
      // Transmit if state changed or joystick is active
      const changed =
        Math.abs(cur.dx - lastSent.dx) > 0.05 ||
        Math.abs(cur.dy - lastSent.dy) > 0.05 ||
        cur.run !== lastSent.run ||
        cur.interact !== lastSent.interact ||
        cur.hide !== lastSent.hide ||
        cur.dx !== 0 ||
        cur.dy !== 0;

      if (changed) {
        multiplayerService.sendControlInput(cur.dx, cur.dy, cur.run, cur.interact, cur.hide);
        lastSent = { ...cur };
      }
    }, 33); // ~30 fps

    return () => clearInterval(interval);
  }, [isConnected]);

  // Joystick Pointer Event Handlers
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    triggerHaptic(15);
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
    // STOP IMMEDIATELY
    setKnobPos({ x: 0, y: 0 });
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
    if (isConnected) {
      multiplayerService.sendControlInput(0, 0, inputRef.current.run, inputRef.current.interact, inputRef.current.hide);
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const base = joystickBaseRef.current;
    if (!base) return;

    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 10;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > maxRadius) {
      deltaX = (deltaX / distance) * maxRadius;
      deltaY = (deltaY / distance) * maxRadius;
    }

    setKnobPos({ x: deltaX, y: deltaY });

    // Normalized -1 to +1
    let normX = deltaX / maxRadius;
    let normY = deltaY / maxRadius;

    // Normalization length clamp
    const normLen = Math.hypot(normX, normY);
    if (normLen > 1) {
      normX /= normLen;
      normY /= normLen;
    }

    inputRef.current.dx = parseFloat(normX.toFixed(2));
    inputRef.current.dy = parseFloat(normY.toFixed(2));
  };

  // Run Button Handlers (continuous hold)
  const handleRunDown = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.run = true;
    triggerHaptic(20);
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, true, inputRef.current.interact);
    }
  };

  const handleRunUp = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.run = false;
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, false, inputRef.current.interact);
    }
  };

  // Interact Button Handlers (E key)
  const handleInteractDown = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.interact = true;
    triggerHaptic(30);
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, inputRef.current.run, true);
    }
  };

  const handleInteractUp = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.interact = false;
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, inputRef.current.run, false);
    }
  };

  // Secondary Hide Button
  const handleHideDown = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.hide = true;
    inputRef.current.interact = true;
    triggerHaptic(35);
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, inputRef.current.run, true, true);
    }
  };

  const handleHideUp = (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current.hide = false;
    inputRef.current.interact = false;
    if (isConnected) {
      multiplayerService.sendControlInput(inputRef.current.dx, inputRef.current.dy, inputRef.current.run, false, false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-[#07090e] text-white font-mono overflow-hidden select-none flex flex-col justify-between p-4"
      style={{ touchAction: 'none' }}
    >
      {/* HEADER BAR */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-widest text-amber-400 uppercase">
              FUJA DA SOLANGE!!
            </h1>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
              Controle Remoto Virtual
            </span>
          </div>
        </div>

        {/* Status Badge & Fullscreen */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
              isConnected
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-red-950/80 border-red-600 text-red-300'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? `Jogador ${playerIndex}` : 'Desconectado'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-1.5 rounded border border-neutral-700 cursor-pointer"
            title="Tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* TELEMETRY HUD BAR (Shown when connected) */}
      {isConnected && (
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-lg p-2.5 my-1 flex items-center justify-between gap-3 text-xs shrink-0 shadow-lg">
          {/* Stamina Meter */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-400">
              <span>Estamina</span>
              <span className={telemetry.stamina < 25 ? 'text-red-400' : 'text-emerald-400'}>
                {Math.round(telemetry.stamina)}%
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className={`h-full transition-all duration-75 ${
                  telemetry.stamina < 25 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${telemetry.stamina}%` }}
              />
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {telemetry.isHiding ? (
              <span className="bg-blue-950 border border-blue-600 text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                <DoorClosed className="w-3 h-3" /> No Armário
              </span>
            ) : telemetry.isDowned ? (
              <span className="bg-red-950 border border-red-600 text-red-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> Caído!
              </span>
            ) : telemetry.noiseLevel > 15 ? (
              <span className="bg-amber-950 border border-amber-600 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 animate-pulse">
                <ShieldAlert className="w-3 h-3" /> Fazendo Som
              </span>
            ) : (
              <span className="bg-neutral-900 border border-neutral-700 text-neutral-300 px-2 py-0.5 rounded text-[10px]">
                Silencioso
              </span>
            )}

            {telemetry.zone && (
              <span className="hidden sm:inline text-[10px] text-neutral-400 max-w-[100px] truncate">
                {telemetry.zone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CONNECTION FORM (Shown if not yet connected) */}
      {!isConnected ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-neutral-200 uppercase">Digitar Código do Controle</h2>
            <p className="text-xs text-neutral-400">
              Digite o código de 6 caracteres exibido na tela do computador:
            </p>
          </div>

          <div className="w-full flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EX: 7K4P9X"
              className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-amber-500 rounded px-3 py-3 text-center text-lg font-black tracking-[0.2em] uppercase text-amber-400 outline-none"
            />
            <button
              onClick={() => handleConnect()}
              className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-5 py-3 rounded text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Conectar
            </button>
          </div>

          <div className="text-xs text-neutral-400 text-center">{connectionMessage}</div>
        </div>
      ) : (
        /* MAIN GAMEPAD CONTROLS */
        <main className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6 py-2 px-2 overflow-hidden">
          {/* LEFT: ANALOG VIRTUAL JOYSTICK */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-2">
              ◄ ANALÓGICO VIRTUAL ►
            </div>

            <div
              ref={joystickBaseRef}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
              className="relative w-52 h-52 md:w-64 md:h-64 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-[inset_0_0_24px_rgba(0,0,0,0.8)] flex items-center justify-center cursor-pointer select-none"
              style={{ touchAction: 'none' }}
            >
              {/* Inner crosshair guidelines */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-full h-0.5 bg-neutral-500" />
                <div className="h-full w-0.5 bg-neutral-500 absolute" />
              </div>

              {/* Movable Knob */}
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-b from-neutral-700 to-neutral-900 border-2 border-amber-500 shadow-2xl flex items-center justify-center pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/80 shadow-inner" />
              </div>
            </div>
          </div>

          {/* RIGHT: ACTION BUTTONS (CORRER / INTERAGIR / ESCONDER) */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 w-full max-w-sm">
            {/* CORRER BUTTON (Sprint - Continuous Hold) */}
            <button
              onPointerDown={handleRunDown}
              onPointerUp={handleRunUp}
              onPointerCancel={handleRunUp}
              onPointerLeave={handleRunUp}
              className={`w-full py-4 md:py-6 rounded-2xl border-2 font-black text-sm md:text-base uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl transition active:scale-95 cursor-pointer ${
                inputRef.current.run
                  ? 'bg-red-600 border-red-400 text-white shadow-red-900/50 scale-98'
                  : 'bg-red-950/80 border-red-700 text-red-200 hover:bg-red-900/80'
              }`}
              style={{ touchAction: 'none' }}
            >
              <Zap className="w-5 h-5" />
              <span>SEGURE PARA CORRER</span>
            </button>

            {/* INTERAGIR BUTTON (Key E) */}
            <button
              onPointerDown={handleInteractDown}
              onPointerUp={handleInteractUp}
              onPointerCancel={handleInteractUp}
              onPointerLeave={handleInteractUp}
              className={`w-full py-4 md:py-6 rounded-2xl border-2 font-black text-sm md:text-base uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl transition active:scale-95 cursor-pointer ${
                inputRef.current.interact
                  ? 'bg-amber-500 border-amber-300 text-black shadow-amber-900/50 scale-98'
                  : 'bg-amber-950/80 border-amber-600 text-amber-200 hover:bg-amber-900/80'
              }`}
              style={{ touchAction: 'none' }}
            >
              <Hand className="w-5 h-5" />
              <span>INTERAGIR / PEGAR [E]</span>
            </button>

            {/* ESCONDER / ARMARIO ACTION BUTTON */}
            <button
              onPointerDown={handleHideDown}
              onPointerUp={handleHideUp}
              onPointerCancel={handleHideUp}
              onPointerLeave={handleHideUp}
              className="w-full py-3 rounded-xl border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
              style={{ touchAction: 'none' }}
            >
              <DoorClosed className="w-4 h-4 text-amber-400" />
              <span>Esconder-se / Sair do Armário</span>
            </button>
          </div>
        </main>
      )}

      {/* FOOTER BAR */}
      <footer className="border-t border-neutral-900 pt-2 text-center text-[10px] text-neutral-500 flex items-center justify-between shrink-0">
        <span>Olhe para a tela do computador • Use o tablet para controlar</span>
        <button
          onClick={() => {
            window.location.href = window.location.origin;
          }}
          className="text-neutral-400 hover:text-white underline cursor-pointer"
        >
          Ir para Tela do Jogo
        </button>
      </footer>
    </div>
  );
};
