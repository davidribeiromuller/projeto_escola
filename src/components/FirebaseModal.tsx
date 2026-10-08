import React, { useState } from 'react';
import { Database, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { getStoredFirebaseConfig, isFirebaseConfigured, FirebaseConfigParams } from '../services/firebaseConfig';

interface FirebaseModalProps {
  onClose: () => void;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({ onClose }) => {
  const currentConfig = getStoredFirebaseConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [databaseURL, setDatabaseURL] = useState(currentConfig.databaseURL || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    const configToSave: FirebaseConfigParams = {
      apiKey: apiKey.trim(),
      databaseURL: databaseURL.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim(),
    };
    localStorage.setItem('escola_firebase_config', JSON.stringify(configToSave));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const hasConfig = isFirebaseConfigured();

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 font-mono">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-lg w-full p-6 text-neutral-300 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h2 className="text-base font-bold text-amber-400 tracking-wider flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            CONFIGURAÇÃO DO FIREBASE REALTIME DB
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition cursor-pointer text-sm"
          >
            ✕ Fechar
          </button>
        </div>

        <div className="text-xs space-y-3 text-neutral-400 leading-relaxed">
          <div className="bg-neutral-900/80 p-3 rounded border border-neutral-800">
            <div className="flex items-center gap-2 mb-1">
              {hasConfig ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Firebase Realtime DB Detectado</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-bold">Modo Servidor WebSocket Ativo</span>
                </>
              )}
            </div>
            <p className="text-[11px]">
              O jogo já está <strong>100% pronto para jogar multiplayer</strong> utilizando o servidor WebSocket integrado na porta 3000! Caso queira apontar para sua instância própria do Firebase Realtime Database e autenticação anônima, insira as chaves abaixo:
            </p>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] text-neutral-300 mb-1">API Key (VITE_FIREBASE_API_KEY)</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded text-white text-xs font-mono focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-300 mb-1">Database URL (VITE_FIREBASE_DATABASE_URL)</label>
              <input
                type="text"
                value={databaseURL}
                onChange={(e) => setDatabaseURL(e.target.value)}
                placeholder="https://seu-projeto-default-rtdb.firebaseio.com"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded text-white text-xs font-mono focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-300 mb-1">Project ID (VITE_FIREBASE_PROJECT_ID)</label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="depois-da-ultima-aula"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded text-white text-xs font-mono focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-neutral-900/50 p-2.5 rounded border border-neutral-800 text-[11px] text-neutral-400">
            💡 As regras de segurança para o Realtime Database foram geradas no arquivo <code className="text-amber-300">database.rules.json</code> na raiz do projeto (limitando a 2 jogadores por sala).
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400">Configurações salvas!</span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSave}
              className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
