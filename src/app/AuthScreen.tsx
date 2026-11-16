import React, {useMemo, useState} from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {BloodDropEmblem} from '../components/BrandMark';
import {Button, Card, Input, Select} from '../components/ui/primitives';
import {makeDefaultSettingsForUser} from '../database/migrations';
import {db} from '../database/schema';
import {userRegistrationSchema} from '../services/validation';
import type {UserProfile} from '../types';
import {verifyPin} from '../utils/crypto';
import {calculateAgeFromBirthDate} from '../utils/date';
import {createHashedUserProfile, resizeProfileImageFile} from '../utils/profile';

interface AuthScreenProps {
  users: UserProfile[];
  onAuthenticated: (user: UserProfile) => void;
}

type AuthMode = 'welcome' | 'login' | 'register' | 'forgot';

export const AuthScreen: React.FC<AuthScreenProps> = ({users, onAuthenticated}) => {
  const [mode, setMode] = useState<AuthMode>('welcome');

  // Login state
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Registration state
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('1995-05-15');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [sex, setSex] = useState<'feminino' | 'masculino' | 'outro' | 'nao_informar'>(
    'nao_informar'
  );
  const [heightCm, setHeightCm] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  // Optional health info
  const [diabetesType, setDiabetesType] = useState('');
  const [diagnosisDate, setDiagnosisDate] = useState('');
  const [treatmentType, setTreatmentType] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [extraHealthInfo, setExtraHealthInfo] = useState('');
  // Preferences
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'YYYY-MM-DD'>('DD/MM/YYYY');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);

  const [regError, setRegError] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  const selectedLoginUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0] || null,
    [users, selectedUserId]
  );

  const calculatedAge = useMemo(
    () => calculateAgeFromBirthDate(birthDate),
    [birthDate]
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const resized = await resizeProfileImageFile(file);
      setAvatarDataUrl(resized);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Erro ao carregar foto.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!selectedLoginUser) {
      setLoginError('Nenhum perfil local selecionado. Crie uma conta primeiro.');
      return;
    }

    // Starter profile without password can enter directly; password-protected profiles verify PBKDF2 hash
    if (selectedLoginUser.passwordHash && selectedLoginUser.passwordSalt) {
      if (!loginPassword.trim()) {
        setLoginError('Informe sua senha para entrar neste perfil.');
        return;
      }
      setLoginBusy(true);
      try {
        const ok = await verifyPin(
          loginPassword,
          selectedLoginUser.passwordHash,
          selectedLoginUser.passwordSalt
        );
        if (!ok) {
          setLoginError('Senha incorreta. Tente novamente.');
          return;
        }
      } catch (err) {
        setLoginError(
          err instanceof Error ? err.message : 'Não foi possível verificar a senha.'
        );
        return;
      } finally {
        setLoginBusy(false);
      }
    }

    onAuthenticated(selectedLoginUser);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (password !== passwordConfirm) {
      setRegError('As senhas informadas não coincidem.');
      return;
    }

    const heightNum = heightCm.trim() ? Number(heightCm) : undefined;
    const parsed = userRegistrationSchema.safeParse({
      fullName,
      displayName: displayName.trim() || fullName.trim().split(' ')[0],
      birthDate,
      password,
      sex,
      heightCm: Number.isFinite(heightNum) ? heightNum : undefined,
      diabetesType: diabetesType.trim() || undefined,
      diagnosisDate: diagnosisDate.trim() || undefined,
      treatmentType: treatmentType.trim() || undefined,
      personalNotes: personalNotes.trim() || undefined,
    });

    if (!parsed.success) {
      setRegError(parsed.error.issues[0]?.message || 'Verifique os campos obrigatórios.');
      return;
    }

    if (calculatedAge === null) {
      setRegError('Informe uma data de nascimento válida (não futura).');
      return;
    }

    setRegBusy(true);
    try {
      const newProfile = await createHashedUserProfile({
        fullName: parsed.data.fullName,
        displayName: parsed.data.displayName,
        birthDate: parsed.data.birthDate,
        password: parsed.data.password,
        sex: parsed.data.sex,
        heightCm: parsed.data.heightCm,
        avatarDataUrl,
        diabetesType: parsed.data.diabetesType,
        diagnosisDate: parsed.data.diagnosisDate,
        treatmentType: parsed.data.treatmentType,
        personalNotes: parsed.data.personalNotes,
        extraHealthInfo: extraHealthInfo.trim() || undefined,
        dateFormat,
        notificationsEnabled,
        highContrastMode,
      });

      const userSettings = makeDefaultSettingsForUser(newProfile);
      await db.transaction('rw', db.users, db.settings, async () => {
        await db.users.put(newProfile);
        await db.settings.put(userSettings);
      });

      onAuthenticated(newProfile);
    } catch (err) {
      setRegError(
        err instanceof Error ? err.message : 'Não foi possível criar a conta local.'
      );
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0D0D0D] text-white relative overflow-y-auto flex items-center justify-center px-4 py-8"
      data-testid="auth-screen"
    >
      {/* Sukuna Hero Backdrop */}
      <div className="pointer-events-none fixed inset-0 flex justify-end overflow-hidden">
        <div className="relative w-full lg:w-[55%] h-full opacity-40 lg:opacity-55">
          <img
            src="./src/assets/images/sukuna_cursed_hero_1794849858421.jpg"
            alt="Arte temática CarbControl Sukuna Edition"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-[#0D0D0D]/70" />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="sukuna-aura-breath absolute -top-24 right-[10%] h-72 w-72 rounded-full bg-[#B00020]/20 blur-3xl" />
        <span
          className="sukuna-ember"
          style={{left: '14%', bottom: '10%', width: '5px', height: '5px', '--ember-duration': '5.4s', '--ember-delay': '0.2s'} as React.CSSProperties}
        />
        <span
          className="sukuna-ember"
          style={{left: '78%', bottom: '18%', width: '6px', height: '6px', '--ember-duration': '6.1s', '--ember-delay': '1.1s'} as React.CSSProperties}
        />
        <span
          className="sukuna-ember"
          style={{left: '88%', bottom: '12%', width: '4px', height: '4px', '--ember-duration': '4.8s', '--ember-delay': '0.6s'} as React.CSSProperties}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        {/* Brand Header */}
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2.5">
            <div className="sukuna-drop-pulse">
              <BloodDropEmblem size={42} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="text-white">Carb</span>
              <span className="text-[#FF243D]">Control</span>
            </h1>
          </div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#FF243D] font-semibold">
            Sukuna Edition · Perfis Locais Seguros
          </p>
          <p className="text-sm text-[#B5B5B5]">
            Conheça seus alimentos. Registre seus carboidratos.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
        {/* WELCOME SCREEN */}
        {mode === 'welcome' && (
          <motion.div
            key="auth-welcome"
            initial={{opacity: 0, y: 10, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -8, scale: 0.985}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
          <Card className="p-6 sm:p-7 space-y-6">
            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-bold">Bem-vindo ao seu diário nutricional</h2>
              <p className="text-xs sm:text-sm text-[#B5B5B5]">
                Seus dados ficam salvos exclusivamente neste dispositivo, isolados por perfil individual.
              </p>
            </div>

            {users.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#B5B5B5]">
                  Perfis disponíveis neste dispositivo:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {users.map((u) => {
                    const age = calculateAgeFromBirthDate(u.birthDate);
                    const hasPassword = Boolean(u.passwordHash && u.passwordSalt);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (!hasPassword) {
                            onAuthenticated(u);
                          } else {
                            setSelectedUserId(u.id);
                            setLoginPassword('');
                            setLoginError(null);
                            setMode('login');
                          }
                        }}
                        className="sukuna-card-interactive flex items-center justify-between gap-3 rounded-xl border border-[#650000]/60 bg-[#1A1013] p-3 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {u.avatarDataUrl ? (
                            <img
                              src={u.avatarDataUrl}
                              alt={u.displayName}
                              className="w-10 h-10 rounded-full object-cover border border-[#FF243D]/50 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#B00020]/30 border border-[#FF243D]/40 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-[#FF243D]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{u.displayName}</p>
                            <p className="text-[11px] text-[#B5B5B5] truncate">
                              {age !== null ? `${age} anos` : ''}
                              {u.diabetesType ? ` · ${u.diabetesType}` : ''}
                            </p>
                          </div>
                        </div>
                        {hasPassword ? (
                          <Lock className="w-4 h-4 text-[#FF243D] shrink-0" />
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                            Entrar →
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={() => {
                  setLoginError(null);
                  setLoginPassword('');
                  setMode('login');
                }}
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  setRegError(null);
                  setMode('register');
                }}
              >
                <UserPlus className="w-4 h-4 text-[#FF243D]" />
                <span>Criar minha conta</span>
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#650000]/40 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#B5B5B5]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Armazenamento 100% local e offline
              </span>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[#FF243D] hover:underline cursor-pointer font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
          </Card>
          </motion.div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <motion.div
            key="auth-login"
            initial={{opacity: 0, y: 10, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -8, scale: 0.985}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="inline-flex items-center gap-1.5 text-xs text-[#B5B5B5] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <h2 className="text-lg font-bold">Entrar no CarbControl</h2>
              <span className="w-12" />
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Perfil Local</label>
                <Select
                  value={selectedLoginUser?.id || ''}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setLoginError(null);
                    setLoginPassword('');
                  }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.fullName})
                    </option>
                  ))}
                </Select>
              </div>

              {selectedLoginUser?.passwordHash ? (
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">Senha da conta</label>
                  <div className="relative">
                    <Input
                      type={showLoginPwd ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      autoFocus
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPwd((v) => !v)}
                      aria-label="Mostrar ou ocultar senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5B5B5] hover:text-white cursor-pointer"
                    >
                      {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-3 text-xs text-emerald-200">
                  Este perfil inicial ainda não possui senha configurada. Clique em{' '}
                  <strong>Entrar</strong> e, se desejar, defina uma senha em Perfil / Configurações.
                </div>
              )}

              {loginError && <p className="text-xs text-red-400">{loginError}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={loginBusy}>
                <LogIn className="w-4 h-4" />
                <span>
                  {selectedLoginUser
                    ? `Entrar como ${selectedLoginUser.displayName}`
                    : 'Entrar'}
                </span>
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#650000]/40">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-[#B5B5B5] hover:text-white cursor-pointer"
              >
                Criar minha conta
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[#FF243D] hover:underline cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>
          </Card>
          </motion.div>
        )}

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <motion.div
            key="auth-register"
            initial={{opacity: 0, y: 10, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -8, scale: 0.985}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="inline-flex items-center gap-1.5 text-xs text-[#B5B5B5] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <h2 className="text-lg font-bold">Criar minha conta local</h2>
              <span className="w-12" />
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              {/* Photo + Basic Info */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="relative cursor-pointer group shrink-0">
                  {avatarDataUrl ? (
                    <img
                      src={avatarDataUrl}
                      alt="Prévia da foto de perfil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#FF243D]"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#1A1013] border-2 border-dashed border-[#FF243D]/60 flex flex-col items-center justify-center text-[10px] text-[#B5B5B5] group-hover:border-[#FF243D]">
                      <Camera className="w-5 h-5 text-[#FF243D] mb-1" />
                      <span>Foto opcional</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#B5B5B5] block mb-1">
                      Nome completo *
                    </label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Maria Clara Oliveira"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#B5B5B5] block mb-1">
                      Nome de exibição *
                    </label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Maria"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">
                    Data de nascimento *
                  </label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-[#FF243D] mt-1 font-medium">
                    {calculatedAge !== null
                      ? `Idade calculada: ${calculatedAge} anos`
                      : 'Data inválida'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">
                    Sexo (opcional)
                  </label>
                  <Select
                    value={sex}
                    onChange={(e) =>
                      setSex(
                        e.target.value as
                          | 'feminino'
                          | 'masculino'
                          | 'outro'
                          | 'nao_informar'
                      )
                    }
                  >
                    <option value="nao_informar">Prefiro não informar</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">
                    Altura em cm (opcional)
                  </label>
                  <Input
                    type="number"
                    min="40"
                    max="260"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="Ex: 168"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">
                    Senha (mínimo 4 caracteres) *
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[#B5B5B5] block mb-1">
                    Confirmar senha *
                  </label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Optional Health Information */}
              <div className="rounded-xl border border-[#650000]/50 bg-[#1A1013]/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#FF243D]">
                    Informações de Saúde (Totalmente Opcionais)
                  </p>
                  <span className="text-[11px] text-[#B5B5B5]">
                    Pode preencher depois
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-[#B5B5B5] block mb-1">
                      Tipo de diabetes
                    </label>
                    <Input
                      value={diabetesType}
                      onChange={(e) => setDiabetesType(e.target.value)}
                      placeholder="Ex: Tipo 1, Tipo 2..."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#B5B5B5] block mb-1">
                      Ano/data diagnóstico
                    </label>
                    <Input
                      value={diagnosisDate}
                      onChange={(e) => setDiagnosisDate(e.target.value)}
                      placeholder="Ex: 2021"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#B5B5B5] block mb-1">
                      Tipo de tratamento
                    </label>
                    <Input
                      value={treatmentType}
                      onChange={(e) => setTreatmentType(e.target.value)}
                      placeholder="Ex: Contagem de carbs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#B5B5B5] block mb-1">
                      Observações pessoais
                    </label>
                    <Input
                      value={personalNotes}
                      onChange={(e) => setPersonalNotes(e.target.value)}
                      placeholder="Ex: Alergias ou metas"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#B5B5B5] block mb-1">
                      Informações complementares
                    </label>
                    <Input
                      value={extraHealthInfo}
                      onChange={(e) => setExtraHealthInfo(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-[#B5B5B5] block mb-1">
                    Formato de data
                  </label>
                  <Select
                    value={dateFormat}
                    onChange={(e) =>
                      setDateFormat(e.target.value as 'DD/MM/YYYY' | 'YYYY-MM-DD')
                    }
                  >
                    <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                    <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                  </Select>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-[#650000]/50 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="accent-[#FF243D]"
                  />
                  <span>Lembretes locais</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[#650000]/50 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highContrastMode}
                    onChange={(e) => setHighContrastMode(e.target.checked)}
                    className="accent-[#FF243D]"
                  />
                  <span>Alto contraste</span>
                </label>
              </div>

              {regError && <p className="text-xs text-red-400">{regError}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={regBusy}>
                <CheckCircle2 className="w-4 h-4" />
                <span>Concluir Cadastro e Entrar</span>
              </Button>
            </form>
          </Card>
          </motion.div>
        )}

        {/* FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <motion.div
            key="auth-forgot"
            initial={{opacity: 0, y: 10, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -8, scale: 0.985}}
            transition={{duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
          >
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="inline-flex items-center gap-1.5 text-xs text-[#B5B5B5] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#FF243D]" />
                <span>Esqueci minha senha</span>
              </h2>
              <span className="w-12" />
            </div>

            <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 space-y-2 text-xs leading-relaxed text-amber-100">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Segurança 100% Local (Sem Servidor Externo)</span>
              </div>
              <p>
                No CarbControl, suas senhas são protegidas localmente com hash criptográfico
                PBKDF2-SHA256 e nunca são enviadas para servidores ou e-mail. Por segurança real,
                não existe redefinição automática sem validar sua identidade.
              </p>
              <p>
                <strong>O que você pode fazer:</strong> crie um novo perfil local para continuar
                usando o aplicativo imediatamente e, se possuir um backup individual exportado em
                JSON, importe seus dados em <em>Configurações → Backup e Restauração</em>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={() => setMode('register')}>
                <UserPlus className="w-4 h-4" />
                <span>Criar Novo Perfil Local</span>
              </Button>
              <Button variant="secondary" onClick={() => setMode('login')}>
                <LogIn className="w-4 h-4 text-[#FF243D]" />
                <span>Tentar Entrar Novamente</span>
              </Button>
            </div>
          </Card>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};
