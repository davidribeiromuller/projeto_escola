/**
 * Pre-Match Map Overview Modal
 * Shown for 5-8 seconds before gameplay begins.
 * Shows the full schematic of the school with sector labels, initial player spawn,
 * and Solange's starting position in Sala dos Professores.
 * Never available again after dismissal!
 */

import React, { useState, useEffect } from 'react';
import { MapPin, User, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import { SOLANGE_INITIAL_SPAWN, PLAYER_SPAWNS } from './mapData';

interface PreMatchMapModalProps {
  playerIndex: 1 | 2;
  onDismiss: () => void;
}

export const PreMatchMapModal: React.FC<PreMatchMapModalProps> = ({ playerIndex, onDismiss }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(7);

  const playerSpawn = PLAYER_SPAWNS[playerIndex - 1] || PLAYER_SPAWNS[0];
  const partnerSpawn = PLAYER_SPAWNS[playerIndex === 1 ? 1 : 0];

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 select-none font-mono text-white animate-fade-in">
      <div className="max-w-4xl w-full bg-neutral-950 border border-neutral-800 rounded-lg p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm tracking-wider uppercase">
              <Eye className="w-4 h-4" /> PLANTA BAIXA DA ESCOLA (PRÉ-PARTIDA)
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Observe o mapa e memorize os caminhos. Este mapa NÃO estará disponível após o início!
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs px-3 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
          >
            Entrar na Escola ({secondsLeft}s) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tactical Schematic Blueprint */}
        <div className="relative w-full aspect-[16/9] bg-[#0c1017] border-2 border-neutral-700 rounded overflow-hidden p-3 flex flex-col justify-between shadow-inner">
          {/* Grid Blueprint Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

          {/* Row 1: Salas de Aula */}
          <div className="relative z-10 grid grid-cols-4 gap-2 h-14">
            <div className="bg-neutral-900/80 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px] text-neutral-300 font-bold relative">
              <span>SALA 1</span>
              {playerIndex === 1 && (
                <div className="absolute top-1 right-1 flex items-center gap-1 bg-blue-600 text-[9px] px-1.5 py-0.5 rounded-full text-white animate-bounce shadow">
                  <User className="w-2.5 h-2.5" /> VOCÊ
                </div>
              )}
            </div>
            <div className="bg-neutral-900/80 border border-neutral-700 rounded flex items-center justify-center text-[10px] text-neutral-300 font-bold">
              <span>SALA 2</span>
            </div>
            <div className="bg-neutral-900/80 border border-neutral-700 rounded flex items-center justify-center text-[10px] text-neutral-300 font-bold">
              <span>SALA 3</span>
            </div>
            <div className="bg-neutral-900/80 border border-neutral-700 rounded flex items-center justify-center text-[10px] text-neutral-300 font-bold">
              <span>SALA 4</span>
            </div>
          </div>

          {/* Row 2: Corredor Principal */}
          <div className="relative z-10 h-7 bg-neutral-800/80 border-y border-neutral-600 flex items-center justify-center text-[10px] text-amber-300/90 font-bold tracking-widest uppercase">
            ◄── CORREDOR PRINCIPAL ──►
          </div>

          {/* Row 3: Biblioteca, Pátio Central, Laboratório */}
          <div className="relative z-10 grid grid-cols-12 gap-2 h-20">
            <div className="col-span-4 bg-indigo-950/40 border border-indigo-700/60 rounded flex flex-col items-center justify-center text-[10px] text-indigo-300 font-bold p-1 text-center">
              <span>BIBLIOTECA</span>
              <span className="text-[8px] text-neutral-400 font-normal">Estantes & Livros</span>
            </div>
            <div className="col-span-4 bg-emerald-950/30 border border-emerald-700/50 rounded flex flex-col items-center justify-center text-[10px] text-emerald-300 font-bold p-1 text-center relative">
              <span>PÁTIO CENTRAL</span>
              <span className="text-[8px] text-neutral-400 font-normal">Bancos & Praça Aberta</span>
              <div className="text-[8px] text-neutral-500 mt-1">▼ ESCADAS ▼</div>
            </div>
            <div className="col-span-4 bg-cyan-950/40 border border-cyan-700/60 rounded flex flex-col items-center justify-center text-[10px] text-cyan-300 font-bold p-1 text-center">
              <span>LABORATÓRIO</span>
              <span className="text-[8px] text-neutral-400 font-normal">Bancadas & Fusíveis</span>
            </div>
          </div>

          {/* Row 4: Secretaria, Sala dos Professores (SOLANGE), Depósito */}
          <div className="relative z-10 grid grid-cols-12 gap-2 h-20">
            <div className="col-span-4 bg-neutral-900/80 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px] text-neutral-300 font-bold p-1 text-center">
              <span>SECRETARIA</span>
              <span className="text-[8px] text-neutral-400 font-normal">Computador da Diretoria</span>
            </div>
            <div className="col-span-4 bg-red-950/70 border-2 border-red-600 rounded flex flex-col items-center justify-center text-[10px] text-red-300 font-bold p-1 text-center relative shadow-lg">
              <span className="text-red-400">SALA DOS PROFESSORES</span>
              {/* SOLANGE SPAWN PIN */}
              <div className="flex items-center gap-1 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full mt-1 font-black animate-pulse shadow-md">
                <MapPin className="w-2.5 h-2.5" /> SOLANGE (SPAWN)
              </div>
            </div>
            <div className="col-span-4 bg-amber-950/30 border border-amber-800/50 rounded flex flex-col items-center justify-center text-[10px] text-amber-200 font-bold p-1 text-center">
              <span>DEPÓSITO</span>
              <span className="text-[8px] text-neutral-400 font-normal">Armários & Caixas</span>
            </div>
          </div>

          {/* Row 5: Banheiros, Refeitório, Ginásio */}
          <div className="relative z-10 grid grid-cols-12 gap-2 h-16">
            <div className="col-span-3 bg-neutral-900/80 border border-neutral-700 rounded flex flex-col items-center justify-center text-[10px] text-neutral-300 font-bold text-center">
              <span>BANHEIROS</span>
              <span className="text-[8px] text-neutral-400 font-normal">Cabines & Pias</span>
            </div>
            <div className="col-span-6 bg-yellow-950/30 border border-yellow-700/50 rounded flex flex-col items-center justify-center text-[10px] text-yellow-300 font-bold text-center relative">
              <span>REFEITÓRIO</span>
              <span className="text-[8px] text-neutral-400 font-normal">Mesas & Cozinha</span>
              {playerIndex === 2 && (
                <div className="absolute top-1 right-2 flex items-center gap-1 bg-amber-600 text-[9px] px-1.5 py-0.5 rounded-full text-white animate-bounce shadow">
                  <User className="w-2.5 h-2.5" /> VOCÊ
                </div>
              )}
            </div>
            <div className="col-span-3 bg-orange-950/30 border border-orange-700/50 rounded flex flex-col items-center justify-center text-[10px] text-orange-300 font-bold text-center">
              <span>GINÁSIO</span>
              <span className="text-[8px] text-neutral-400 font-normal">Quadra & Saída 2</span>
            </div>
          </div>

          {/* Row 6: ENTRADA / SAÍDA */}
          <div className="relative z-10 h-9 bg-emerald-950/60 border-2 border-emerald-500/80 rounded flex items-center justify-between px-4 text-xs font-bold text-emerald-300">
            <span>🚪 ENTRADA PRINCIPAL / SAÍDA FINAL</span>
            <span className="text-[10px] text-emerald-400 font-normal">Arrombar correntes ao final das missões</span>
          </div>
        </div>

        {/* Warning & Instructions */}
        <div className="flex items-center justify-between bg-neutral-900/70 p-3 rounded border border-neutral-800 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-neutral-300 text-[11px] leading-tight">
              <strong className="text-amber-400 block mb-0.5">
                “Observe o mapa. Memorize sua posição inicial. Solange começará em outro setor.”
              </strong>
              Solange sempre começa na Sala dos Professores, mas começará a patrulhar e ouvir seus passos assim que a partida começar.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 shrink-0 ml-4 border-l border-neutral-800 pl-4 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Você ({playerSpawn.room})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Parceiro ({partnerSpawn.room})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span className="text-red-300 font-bold">Solange (Professores)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
