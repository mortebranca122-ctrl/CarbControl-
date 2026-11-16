import React, {useState} from 'react';
import {Lock, ShieldAlert} from 'lucide-react';
import {BloodDropEmblem} from '../components/BrandMark';
import {Button, Input} from '../components/ui/primitives';
import {verifyPin} from '../utils/crypto';

interface PinLockScreenProps {
  pinHash: string;
  pinSalt: string;
  userName: string;
  onUnlock: () => void;
  onLogout?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  pinHash,
  pinSalt,
  userName,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pin.trim()) {
      setError('Informe sua senha PIN.');
      return;
    }
    setChecking(true);
    try {
      const ok = await verifyPin(pin.trim(), pinHash, pinSalt);
      if (ok) {
        onUnlock();
      } else {
        setError('PIN incorreto. Tente novamente.');
        setPin('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar PIN.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D] px-4">
      <div className="w-full max-w-sm sukuna-panel rounded-2xl p-6 text-center space-y-5">
        <div className="flex flex-col items-center gap-2">
          <BloodDropEmblem size={44} />
          <h1 className="text-xl font-bold text-white">
            Carb<span className="text-[#FF243D]">Control</span>
          </h1>
          <p className="text-xs text-[#B5B5B5]">
            Acesso protegido para {userName || 'seu dispositivo'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="w-4 h-4 text-[#FF243D] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Digite seu PIN numérico"
              aria-label="Senha PIN"
              className="pl-10 text-center tracking-[0.4em] font-mono-num"
              maxLength={8}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? 'Verificando...' : 'Desbloquear Aplicativo'}
          </Button>
        </form>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-[#B5B5B5] hover:text-[#FF243D] underline underline-offset-4 cursor-pointer"
          >
            Trocar Perfil / Sair
          </button>
        )}
      </div>
    </div>
  );
};
