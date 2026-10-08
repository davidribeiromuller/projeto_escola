import React from 'react';
import { Volume2, Footprints, ShieldAlert, KeyRound, Clock, Users } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 font-mono">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-lg w-full p-6 text-neutral-300 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h2 className="text-lg font-bold text-amber-400 tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            COMO SOBREVIVER À NOITE
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition cursor-pointer text-sm"
          >
            ✕ Fechar
          </button>
        </div>

        <div className="space-y-4 text-xs leading-relaxed">
          <div className="flex gap-3 bg-neutral-900/60 p-3 rounded border border-neutral-800">
            <Volume2 className="w-8 h-8 text-red-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-100 block mb-1">1. O Sistema de Som (Crítico)</strong>
              Antônio não enxerga através das paredes. Ele guia-se pelo som dos seus passos!
              Correr [Shift] gera um ruído alto que se propaga por até 12 tiles. Ande devagar para permanecer imperceptível.
            </div>
          </div>

          <div className="flex gap-3 bg-neutral-900/60 p-3 rounded border border-neutral-800">
            <Footprints className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-100 block mb-1">2. Esconderijos</strong>
              Armários de aço e cabines estão espalhados pela escola. Aproxime-se e pressione [E] para esconder-se dentro. Antônio passará direto se não tiver certeza da sua posição.
            </div>
          </div>

          <div className="flex gap-3 bg-neutral-900/60 p-3 rounded border border-neutral-800">
            <KeyRound className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-100 block mb-1">3. Missões Cooperativas</strong>
              Trabalhe em equipe com o segundo jogador:
              <ul className="list-disc list-inside mt-1 text-neutral-400 space-y-0.5">
                <li>Devolver 3 livros perdidos na Biblioteca;</li>
                <li>Encontrar e instalar os fusíveis nos quadros de disjuntor;</li>
                <li>Reunir as pistas da senha e desbloquear o terminal da Secretaria.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 bg-neutral-900/60 p-3 rounded border border-neutral-800">
            <Clock className="w-8 h-8 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-100 block mb-1">4. Limite de Tempo & Escape</strong>
              A partida dura no máximo 15 minutos. Após cumprir os objetivos, vão juntos ao Portão Principal da entrada e segurem [E] para arrombar as correntes e escapar!
            </div>
          </div>

          <div className="flex gap-3 bg-neutral-900/60 p-3 rounded border border-neutral-800">
            <Users className="w-8 h-8 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-neutral-100 block mb-1">5. Reanimação</strong>
              Se seu parceiro for surpreendido por Antônio, ele ficará incapacitado no chão. Aproxime-se e segure [E] por alguns segundos para levantá-lo antes que Antônio retorne!
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-2.5 rounded transition text-xs tracking-wider cursor-pointer"
        >
          ENTENDIDO, VOLTAR AO MENU
        </button>
      </div>
    </div>
  );
};
