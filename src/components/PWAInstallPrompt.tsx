import React, {useState} from 'react';
import {Download, Monitor, Smartphone} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {Button, Modal} from './ui/primitives';

export const PWAInstallButton: React.FC<{compact?: boolean}> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <Button
        variant={compact ? 'secondary' : 'crimson'}
        size={compact ? 'sm' : 'default'}
        onClick={handleClick}
        aria-label="Instalar CarbControl no dispositivo"
      >
        <Download className="w-4 h-4" />
        <span>{compact ? 'Instalar PWA' : 'Instalar no Android ou Windows'}</span>
      </Button>

      <Modal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="Instalar CarbControl (PWA Offline)"
        subtitle="Use como aplicativo nativo no Windows 10/11, Android ou iOS"
      >
        <div className="space-y-4 text-sm text-zinc-700 dark:text-[#D4D4D8]">
          {isIOS ? (
            <div className="rounded-xl border border-[#650000]/45 bg-rose-50 dark:bg-[#1A1013]/80 p-3.5 text-zinc-900 dark:text-white">
              <p className="font-semibold text-[#FF243D] mb-1.5">iPhone / iPad (Safari)</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-700 dark:text-[#E4E4E7]">
                <li>Toque no ícone de Compartilhar na barra do Safari.</li>
                <li>Role para baixo e escolha <strong>Adicionar à Tela de Início</strong>.</li>
                <li>Toque em <strong>Adicionar</strong> para abrir em modo offline.</li>
              </ol>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#650000]/45 bg-rose-50 dark:bg-[#1A1013] p-3.5 text-zinc-900 dark:text-white">
                <div className="flex items-center gap-2 font-semibold text-[#FF243D] mb-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>Android (Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-700 dark:text-[#D4D4D8]">
                  <li>Abra o menu do navegador (três pontos no canto superior direito).</li>
                  <li>Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                  <li>Confirme para instalar o ícone CarbControl com suporte offline.</li>
                </ol>
              </div>
              <div className="rounded-xl border border-[#650000]/45 bg-rose-50 dark:bg-[#1A1013] p-3.5 text-zinc-900 dark:text-white">
                <div className="flex items-center gap-2 font-semibold text-[#FF243D] mb-1.5">
                  <Monitor className="w-4 h-4" />
                  <span>Windows 10 e Windows 11 (Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-700 dark:text-[#D4D4D8]">
                  <li>Na barra de endereços, clique no ícone de instalação de aplicativo.</li>
                  <li>Ou abra o menu <strong>⋮ &gt; Salvar e compartilhar &gt; Instalar CarbControl</strong>.</li>
                  <li>O aplicativo aparecerá no Menu Iniciar e funcionará offline.</li>
                </ol>
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowGuide(false)}>
              Entendi
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
