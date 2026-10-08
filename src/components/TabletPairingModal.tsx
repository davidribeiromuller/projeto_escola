import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, Copy, Check, X, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { multiplayerService } from '../services/multiplayer';

interface TabletPairingModalProps {
  playerIndex: 1 | 2;
  onClose: () => void;
}

export const TabletPairingModal: React.FC<TabletPairingModalProps> = ({ playerIndex, onClose }) => {
  const [controllerCode, setControllerCode] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const onTokenCreated = (data: any) => {
      setControllerCode(data.controllerCode);
      const baseUrl = window.location.href.split('?')[0].split('#')[0].replace(/\/$/, '');
      const url = `${baseUrl}/?mode=controle&code=${data.controllerCode}`;
      QRCode.toDataURL(url, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((dataUrl) => setQrCodeDataUrl(dataUrl))
        .catch((err) => console.warn('QR error:', err));
    };


    const onConnected = () => {
      setIsConnected(true);
    };

    const onDisconnected = () => {
      setIsConnected(false);
    };

    multiplayerService.on('CONTROLLER_TOKEN_CREATED', onTokenCreated);
    multiplayerService.on('CONTROL_CONNECTED', onConnected);
    multiplayerService.on('CONTROL_DISCONNECTED', onDisconnected);

    // Request new controller code
    multiplayerService.requestControllerToken();

    return () => {
      multiplayerService.off('CONTROLLER_TOKEN_CREATED', onTokenCreated);
      multiplayerService.off('CONTROL_CONNECTED', onConnected);
      multiplayerService.off('CONTROL_DISCONNECTED', onDisconnected);
    };
  }, []);

  const handleCopyCode = () => {
    if (!controllerCode) return;
    navigator.clipboard.writeText(controllerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0].replace(/\/$/, '') : '';
  const directUrl = controllerCode
    ? `${baseUrl}/?mode=controle&code=${controllerCode}`
    : '';


  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 font-mono select-none">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-md w-full p-6 text-neutral-300 shadow-2xl space-y-5 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-amber-950/60 border border-amber-800/80 px-3 py-1 rounded text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Smartphone className="w-4 h-4" /> Controle Remoto
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            CONTROLAR PELO TABLET
          </h2>
          <p className="text-xs text-neutral-400">
            Vincular celular ou tablet ao <strong>Jogador {playerIndex}</strong>
          </p>
        </div>

        {/* QR Code and Code Display */}
        <div className="flex flex-col items-center gap-3 bg-neutral-900/80 p-4 rounded-lg border border-neutral-800">
          {qrCodeDataUrl ? (
            <div className="bg-white p-2 rounded-lg shadow-xl">
              <img src={qrCodeDataUrl} alt="QR Code do Controle" className="w-44 h-44 block" />
            </div>
          ) : (
            <div className="w-44 h-44 flex items-center justify-center bg-neutral-800/50 rounded text-xs text-neutral-500 animate-pulse">
              Gerando QR Code...
            </div>
          )}

          <div className="space-y-1 text-center w-full">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
              Código do Controle:
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black text-amber-400 tracking-[0.25em]">
                {controllerCode || '------'}
              </span>
              {controllerCode && (
                <button
                  onClick={handleCopyCode}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-1.5 rounded transition cursor-pointer"
                  title="Copiar código"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="p-3 rounded border text-xs flex items-center justify-center gap-2">
          {isConnected ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold animate-pulse">
              <CheckCircle className="w-4 h-4" /> Tablet Conectado com Sucesso!
            </span>
          ) : (
            <span className="text-neutral-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block" />
              Aguardando conexão do tablet...
            </span>
          )}
        </div>

        <div className="text-[11px] text-neutral-500 text-left space-y-1 bg-black/40 p-3 rounded">
          <p>1. Aponte a câmera do celular/tablet para o QR Code acima.</p>
          <p>2. Ou abra no navegador do tablet: <span className="text-amber-400 break-all">{directUrl}</span></p>
          <p>3. O tablet funcionará como um gamepad virtual com joystick e botões!</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded text-xs transition cursor-pointer"
        >
          {isConnected ? 'PRONTO, VOLTAR AO JOGO' : 'FECHAR JANELA'}
        </button>
      </div>
    </div>
  );
};
