import React, {useEffect, useRef, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Download,
  Eye,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Scale,
  Shield,
  Trash2,
  Upload,
  User,
  UserCheck,
} from 'lucide-react';
import {PWAInstallButton} from '../../components/PWAInstallPrompt';
import {Button, Card, Input, Modal, Select} from '../../components/ui/primitives';
import {
  clearUserPersonalData,
  deleteUserAccountAndData,
} from '../../database/migrations';
import {db} from '../../database/schema';
import {
  exportBackupFile,
  isEncryptedBackupContent,
  parseAndRestoreBackup,
} from '../../services/backup';
import {pinInputSchema} from '../../services/validation';
import type {AppSettings, UserProfile} from '../../types';
import {generateSaltBase64, hashPin, verifyPin} from '../../utils/crypto';
import {calculateAgeFromBirthDate} from '../../utils/date';
import {resizeProfileImageFile} from '../../utils/profile';

interface SettingsPageProps {
  activeUser: UserProfile;
  allUsers: UserProfile[];
  settings: AppSettings;
  onBack: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onUpdateUser: (patch: Partial<UserProfile>) => Promise<void>;
  onSwitchUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  activeUser,
  allUsers,
  settings,
  onBack,
  onUpdateSettings,
  onUpdateUser,
  onSwitchUser,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupsHistory = useLiveQuery(
    () =>
      db.backups_metadata
        .where('userId')
        .equals(activeUser.id)
        .reverse()
        .limit(5)
        .toArray(),
    [activeUser.id],
    []
  );

  const stats = useLiveQuery(async () => {
    const [foodsCount, mealsCount, glucoseCount, insulinCount, recipesCount] =
      await Promise.all([
        db.foods.count(),
        db.meal_items.where('userId').equals(activeUser.id).count(),
        db.glucose_records.where('userId').equals(activeUser.id).count(),
        db.insulin_records.where('userId').equals(activeUser.id).count(),
        db.recipes.where('userId').equals(activeUser.id).count(),
      ]);
    return {foodsCount, mealsCount, glucoseCount, insulinCount, recipesCount};
  }, [activeUser.id]);

  // Password change modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);

  // PIN modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Backup / Restore modals
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePasswordModal, setRestorePasswordModal] = useState<{
    rawText: string;
    needsPassword: boolean;
  } | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Clear personal records modal vs Delete Account modal
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');

  // Manual & Install Guide modal
  const [manualOpen, setManualOpen] = useState(false);

  // Local draft for personal & optional health profile fields (avoids keystroke race conditions)
  const [fullNameDraft, setFullNameDraft] = useState(activeUser.fullName);
  const [displayNameDraft, setDisplayNameDraft] = useState(activeUser.displayName);
  const [birthDateDraft, setBirthDateDraft] = useState(activeUser.birthDate);
  const [sexDraft, setSexDraft] = useState<'feminino' | 'masculino' | 'outro' | 'nao_informar'>(
    activeUser.sex || 'nao_informar'
  );
  const [heightCmDraft, setHeightCmDraft] = useState(
    activeUser.heightCm !== undefined ? String(activeUser.heightCm) : ''
  );
  const [diabetesTypeDraft, setDiabetesTypeDraft] = useState(activeUser.diabetesType || '');
  const [diagnosisDateDraft, setDiagnosisDateDraft] = useState(activeUser.diagnosisDate || '');
  const [treatmentTypeDraft, setTreatmentTypeDraft] = useState(activeUser.treatmentType || '');
  const [personalNotesDraft, setPersonalNotesDraft] = useState(activeUser.personalNotes || '');
  const [extraHealthInfoDraft, setExtraHealthInfoDraft] = useState(
    activeUser.extraHealthInfo || ''
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setFullNameDraft(activeUser.fullName);
    setDisplayNameDraft(activeUser.displayName);
    setBirthDateDraft(activeUser.birthDate);
    setSexDraft(activeUser.sex || 'nao_informar');
    setHeightCmDraft(activeUser.heightCm !== undefined ? String(activeUser.heightCm) : '');
    setDiabetesTypeDraft(activeUser.diabetesType || '');
    setDiagnosisDateDraft(activeUser.diagnosisDate || '');
    setTreatmentTypeDraft(activeUser.treatmentType || '');
    setPersonalNotesDraft(activeUser.personalNotes || '');
    setExtraHealthInfoDraft(activeUser.extraHealthInfo || '');
    setProfileError(null);
  }, [activeUser.id]);

  const calculatedAge = calculateAgeFromBirthDate(birthDateDraft);

  const handleSaveProfileDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    const trimmedFull = fullNameDraft.trim();
    const trimmedDisplay = displayNameDraft.trim();
    if (trimmedFull.length < 2) {
      setProfileError('O nome completo deve ter pelo menos 2 caracteres.');
      return;
    }
    if (trimmedDisplay.length < 2) {
      setProfileError('O nome de exibição deve ter pelo menos 2 caracteres.');
      return;
    }
    if (calculateAgeFromBirthDate(birthDateDraft) === null) {
      setProfileError('Informe uma data de nascimento válida e não futura.');
      return;
    }
    const parsedHeight = heightCmDraft.trim() ? Number(heightCmDraft.replace(',', '.')) : undefined;
    if (
      parsedHeight !== undefined &&
      (!Number.isFinite(parsedHeight) || parsedHeight < 40 || parsedHeight > 260)
    ) {
      setProfileError('Altura inválida. Informe entre 40 e 260 cm ou deixe em branco.');
      return;
    }

    setSavingProfile(true);
    try {
      await onUpdateUser({
        fullName: trimmedFull,
        displayName: trimmedDisplay,
        birthDate: birthDateDraft,
        sex: sexDraft,
        heightCm: parsedHeight,
        diabetesType: diabetesTypeDraft.trim() || undefined,
        diagnosisDate: diagnosisDateDraft.trim() || undefined,
        treatmentType: treatmentTypeDraft.trim() || undefined,
        personalNotes: personalNotesDraft.trim() || undefined,
        extraHealthInfo: extraHealthInfoDraft.trim() || undefined,
      });
      setStatusMessage({type: 'ok', text: 'Dados do perfil salvos com sucesso.'});
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Erro ao salvar alterações do perfil.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const resized = await resizeProfileImageFile(file);
      await onUpdateUser({avatarDataUrl: resized});
      setStatusMessage({type: 'ok', text: 'Foto de perfil atualizada localmente.'});
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao atualizar foto.',
      });
    }
  };

  const handleChangeAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    if (activeUser.passwordHash && activeUser.passwordSalt) {
      const ok = await verifyPin(
        currentPwd,
        activeUser.passwordHash,
        activeUser.passwordSalt
      );
      if (!ok) {
        setPwdError('A senha atual está incorreta.');
        return;
      }
    }
    if (newPwd.length < 4) {
      setPwdError('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('A confirmação de senha não coincide.');
      return;
    }
    const salt = generateSaltBase64();
    const hash = await hashPin(newPwd, salt);
    await onUpdateUser({passwordHash: hash, passwordSalt: salt});
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdModalOpen(false);
    setStatusMessage({type: 'ok', text: 'Senha da conta atualizada com segurança (PBKDF2).'});
  };

  const handleTogglePin = async () => {
    if (settings.pinEnabled) {
      await onUpdateSettings({
        pinEnabled: false,
        pinHash: undefined,
        pinSalt: undefined,
      });
      setStatusMessage({type: 'ok', text: 'Bloqueio por PIN desativado.'});
    } else {
      setPinValue('');
      setPinConfirm('');
      setPinError(null);
      setPinModalOpen(true);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const parsed = pinInputSchema.safeParse(pinValue);
    if (!parsed.success) {
      setPinError(parsed.error.issues[0]?.message || 'PIN inválido.');
      return;
    }
    if (pinValue !== pinConfirm) {
      setPinError('Os dígitos do PIN não coincidem.');
      return;
    }
    const salt = generateSaltBase64();
    const hash = await hashPin(pinValue, salt);
    await onUpdateSettings({
      pinEnabled: true,
      pinHash: hash,
      pinSalt: salt,
    });
    setPinModalOpen(false);
    setStatusMessage({type: 'ok', text: 'Bloqueio por PIN ativado com sucesso.'});
  };

  const handleExportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {content, filename, encrypted, itemCount} = await exportBackupFile(
        activeUser.id,
        backupPassword
      );
      const blob = new Blob([content], {type: 'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupPassword('');
      setBackupModalOpen(false);
      setStatusMessage({
        type: 'ok',
        text: `Backup individual ${
          encrypted ? 'criptografado (AES-GCM)' : 'JSON'
        } exportado com ${itemCount} registros de ${activeUser.displayName}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao gerar backup.',
      });
    }
  };

  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const encrypted = isEncryptedBackupContent(text);
      if (encrypted) {
        setRestorePassword('');
        setRestorePasswordModal({rawText: text, needsPassword: true});
      } else {
        const res = await parseAndRestoreBackup(text, activeUser.id);
        setStatusMessage({
          type: 'ok',
          text: `Backup restaurado no perfil ${activeUser.displayName} (${res.restoredCount} registros).`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha na leitura ou restauração do backup.',
      });
    }
  };

  const handleConfirmRestoreEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restorePasswordModal) return;
    try {
      const res = await parseAndRestoreBackup(
        restorePasswordModal.rawText,
        activeUser.id,
        restorePassword
      );
      setRestorePasswordModal(null);
      setStatusMessage({
        type: 'ok',
        text: `Backup criptografado restaurado no perfil ${activeUser.displayName} (${res.restoredCount} registros).`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Senha incorreta.',
      });
    }
  };

  const handleConfirmWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wipeConfirmText.trim().toUpperCase() !== 'APAGAR') return;
    await clearUserPersonalData(activeUser.id);
    setWipeConfirmText('');
    setWipeOpen(false);
    setStatusMessage({
      type: 'ok',
      text: `Registros pessoais de ${activeUser.displayName} apagados. Base nutricional preservada.`,
    });
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteAccountConfirm.trim().toUpperCase() !== 'EXCLUIR') return;
    await deleteUserAccountAndData(activeUser.id);
    setDeleteAccountConfirm('');
    setDeleteAccountOpen(false);
    onLogout();
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar ao início"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#650000]/50 hover:bg-[#B00020]/20 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Perfil e Configurações
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setManualOpen(true)}>
            <BookOpen className="w-4 h-4 text-[#FF243D]" />
            <span>Manual e Instalação</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4 text-[#FF243D]" />
            <span>Sair da Conta</span>
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            statusMessage.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              : 'border-red-500/40 bg-red-950/30 text-red-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Section 0: Perfil Pessoal & Contas Locais (§27) */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold tracking-wider text-zinc-500 dark:text-[#B5B5B5]">
          Meu Perfil Pessoal
        </h2>
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-[#650000]/35 pb-4">
            <label className="relative cursor-pointer group shrink-0">
              {activeUser.avatarDataUrl ? (
                <img
                  src={activeUser.avatarDataUrl}
                  alt={activeUser.displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#FF243D]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-[#1A1013] border-2 border-[#FF243D]/50 flex items-center justify-center">
                  <User className="w-8 h-8 text-[#FF243D]" />
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#B00020] text-white flex items-center justify-center border border-[#0D0D0D]">
                <Camera className="w-3.5 h-3.5" />
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-extrabold">{activeUser.fullName}</h3>
              <p className="text-xs text-[#FF243D] font-semibold">
                Exibição: {activeUser.displayName}
                {calculatedAge !== null ? ` · ${calculatedAge} anos` : ''}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] mt-0.5">
                Perfil isolado neste dispositivo · Dados nutricionais e clínicos privados
              </p>
            </div>

            <Button size="sm" variant="secondary" onClick={() => setPwdModalOpen(true)}>
              <KeyRound className="w-4 h-4 text-[#FF243D]" />
              <span>{activeUser.passwordHash ? 'Alterar Senha' : 'Definir Senha'}</span>
            </Button>
          </div>

          {/* Personal fields */}
          <form onSubmit={handleSaveProfileDraft} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                  Nome completo
                </label>
                <Input
                  value={fullNameDraft}
                  onChange={(e) => setFullNameDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                  Nome de exibição (saudação)
                </label>
                <Input
                  value={displayNameDraft}
                  onChange={(e) => setDisplayNameDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                  Data de nascimento ({calculatedAge !== null ? `${calculatedAge} anos` : '—'})
                </label>
                <Input
                  type="date"
                  value={birthDateDraft}
                  onChange={(e) => setBirthDateDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                  Sexo (opcional)
                </label>
                <Select
                  value={sexDraft}
                  onChange={(e) =>
                    setSexDraft(
                      e.target.value as 'feminino' | 'masculino' | 'outro' | 'nao_informar'
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
                <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                  Altura em cm (opcional)
                </label>
                <Input
                  type="number"
                  value={heightCmDraft}
                  onChange={(e) => setHeightCmDraft(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Optional Health Info */}
            <div className="border-t border-[#650000]/35 pt-3 space-y-2.5">
              <p className="text-xs font-bold text-[#FF243D]">
                Informações de Saúde (Opcional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                    Tipo de diabetes
                  </label>
                  <Input
                    value={diabetesTypeDraft}
                    onChange={(e) => setDiabetesTypeDraft(e.target.value)}
                    placeholder="Ex: Tipo 1, Tipo 2..."
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                    Data aproximada diagnóstico
                  </label>
                  <Input
                    value={diagnosisDateDraft}
                    onChange={(e) => setDiagnosisDateDraft(e.target.value)}
                    placeholder="Ex: 2021"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                    Tipo de tratamento
                  </label>
                  <Input
                    value={treatmentTypeDraft}
                    onChange={(e) => setTreatmentTypeDraft(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                    Observações pessoais
                  </label>
                  <Input
                    value={personalNotesDraft}
                    onChange={(e) => setPersonalNotesDraft(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                    Informações complementares
                  </label>
                  <Input
                    value={extraHealthInfoDraft}
                    onChange={(e) => setExtraHealthInfoDraft(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            {profileError && <p className="text-xs text-red-400">{profileError}</p>}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={savingProfile}>
                {savingProfile ? 'Salvando...' : 'Salvar Dados do Perfil'}
              </Button>
            </div>
          </form>

          {/* Switch Profile */}
          {allUsers.length > 1 && (
            <div className="border-t border-[#650000]/35 pt-3 space-y-2">
              <p className="text-xs font-bold text-[#B5B5B5]">
                Trocar para outro perfil neste dispositivo:
              </p>
              <div className="flex flex-wrap gap-2">
                {allUsers.map((u) => {
                  const isCurrent = u.id === activeUser.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        if (u.passwordHash) {
                          onLogout();
                        } else {
                          onSwitchUser(u);
                        }
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-[#B00020] border-[#FF243D] text-white'
                          : 'bg-rose-50 dark:bg-[#1A1013] border-[#650000]/50 text-zinc-800 dark:text-[#D4D4D8] hover:border-[#FF243D]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{u.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Section 1: Privacidade e Segurança (matches Reference Image 1) */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold tracking-wider text-zinc-500 dark:text-[#B5B5B5]">
          Privacidade e Segurança
        </h2>
        <Card className="divide-y divide-[#650000]/35 p-0 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#FF243D] shrink-0" />
              <div>
                <p className="text-sm font-semibold">Bloqueio por Senha (PIN)</p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                  Protege o acesso aos registros de {activeUser.displayName}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.pinEnabled}
              aria-label="Ativar ou desativar bloqueio por PIN"
              onClick={() => void handleTogglePin()}
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                settings.pinEnabled ? 'bg-[#B00020]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.pinEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#FF243D] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Dados Apenas no Dispositivo</p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5] leading-relaxed">
                  Nenhuma informação de saúde é enviada para nuvem ou servidores externos.
                  Os registros de cada conta são isolados localmente. Faça backups regularmente.
                </p>
                {stats && (
                  <p className="text-[11px] font-mono-num text-[#FF243D] pt-1">
                    Perfil {activeUser.displayName}: {stats.mealsCount} itens de refeição ·{' '}
                    {stats.glucoseCount} glicemias · {stats.insulinCount} insulinas ·{' '}
                    {stats.recipesCount} receitas · Catálogo global: {stats.foodsCount} alimentos
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-[#FF243D] shrink-0" />
              <div>
                <p className="text-sm font-semibold">Backup e Restauração Individual</p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                  {activeUser.lastBackupAt
                    ? `Último backup: ${new Date(activeUser.lastBackupAt).toLocaleString('pt-BR')}`
                    : 'Nenhum backup exportado ainda — recomendamos exportar regularmente.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBackupModalOpen(true)}
              >
                <Download className="w-4 h-4 text-[#FF243D]" />
                <span>Exportar</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 text-[#FF243D]" />
                <span>Restaurar</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
            </div>
          </div>

          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  Apagar Registros deste Perfil
                </p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                  Exclui refeições, glicemias, insulinas e receitas de {activeUser.displayName}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setWipeOpen(true)}>
                Limpar Registros
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteAccountOpen(true)}>
                Excluir Conta
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 2: Preferências */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold tracking-wider text-zinc-500 dark:text-[#B5B5B5]">
          Preferências
        </h2>
        <Card className="divide-y divide-[#650000]/35 p-0 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-[#FF243D] shrink-0" />
              <div>
                <p className="text-sm font-semibold">Modo Escuro (Sukuna Edition)</p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                  Visual preto profundo com detalhes vermelho sangue
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.darkMode}
              aria-label="Alternar modo escuro"
              onClick={() => void onUpdateSettings({darkMode: !settings.darkMode})}
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                settings.darkMode ? 'bg-[#B00020]' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-[#FF243D] shrink-0" />
              <div>
                <p className="text-sm font-semibold">Alto Contraste (Acessibilidade)</p>
                <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                  Reforça bordas e contraste de leitura
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={activeUser.highContrastMode}
              aria-label="Alternar modo de alto contraste"
              onClick={() =>
                void onUpdateUser({highContrastMode: !activeUser.highContrastMode})
              }
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                activeUser.highContrastMode ? 'bg-[#B00020]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  activeUser.highContrastMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-[#FF243D] shrink-0" />
              <span className="text-sm font-semibold">Unidades de Medida Padrão</span>
            </div>
            <Select
              aria-label="Unidades de Medida"
              value={settings.preferredUnit}
              onChange={(e) =>
                void onUpdateSettings({
                  preferredUnit: e.target.value as 'g' | 'caseira',
                })
              }
              className="max-w-[180px]"
            >
              <option value="caseira">Medidas Caseiras</option>
              <option value="g">Gramas (g)</option>
            </Select>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-[#FF243D] shrink-0" />
              <span className="text-sm font-semibold">Formato de Data & Idioma</span>
            </div>
            <div className="flex items-center gap-3">
              <Select
                aria-label="Formato de data"
                value={activeUser.dateFormat}
                onChange={(e) =>
                  void onUpdateUser({
                    dateFormat: e.target.value as 'DD/MM/YYYY' | 'YYYY-MM-DD',
                  })
                }
                className="max-w-[150px] text-xs"
              >
                <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                <option value="YYYY-MM-DD">AAAA-MM-DD</option>
              </Select>
              <span className="text-xs font-semibold text-[#FF243D]">PT-BR · mg/dL</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 3: Sobre & Instalação PWA */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold tracking-wider text-zinc-500 dark:text-[#B5B5B5]">
          Sobre & Aplicativo Offline (PWA)
        </h2>
        <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-[#FF243D] shrink-0" />
            <div>
              <p className="text-sm font-semibold">Versão do Aplicativo</p>
              <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                CarbControl — Sukuna Edition v2.0.0 · Multibase + Perfis Locais
              </p>
            </div>
          </div>
          <PWAInstallButton />
        </Card>

        {backupsHistory.length > 0 && (
          <Card className="p-4 space-y-2">
            <p className="text-xs font-bold text-[#FF243D]">Histórico de Backups Exportados</p>
            {backupsHistory.map((b) => (
              <div key={b.id} className="flex justify-between text-xs text-zinc-400">
                <span>{b.note}</span>
                <span className="font-mono-num">
                  {new Date(b.exportedAt).toLocaleString('pt-BR')} ({b.itemCount} itens)
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Change Password Modal */}
      <Modal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title={activeUser.passwordHash ? 'Alterar Senha da Conta' : 'Definir Senha da Conta'}
        subtitle="Armazenamento seguro local com salt e PBKDF2-SHA256"
      >
        <form onSubmit={handleChangeAccountPassword} className="space-y-3">
          {activeUser.passwordHash && (
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Senha atual</label>
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">
              Nova senha (mínimo 4 caracteres)
            </label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Confirmar nova senha</label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </div>
          {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPwdModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Senha</Button>
          </div>
        </form>
      </Modal>

      {/* PIN Setup Modal */}
      <Modal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title="Configurar Bloqueio por PIN"
        subtitle="Use de 4 a 8 dígitos numéricos para proteger o acesso local"
      >
        <form onSubmit={handleSavePin} className="space-y-3">
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Novo PIN (4 a 8 dígitos)</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
            />
          </div>
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Confirmar PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
            />
          </div>
          {pinError && <p className="text-xs text-red-400">{pinError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPinModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Ativar Bloqueio</Button>
          </div>
        </form>
      </Modal>

      {/* Export Backup Modal */}
      <Modal
        open={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        title="Exportar Backup Individual"
        subtitle="Opcionalmente proteja seu arquivo com criptografia AES-256-GCM"
      >
        <form onSubmit={handleExportBackup} className="space-y-4">
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">
              Senha de criptografia (deixe em branco para JSON simples)
            </label>
            <Input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Senha forte opcional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBackupModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Gerar e Baixar Backup</Button>
          </div>
        </form>
      </Modal>

      {/* Restore Encrypted Backup Modal */}
      <Modal
        open={Boolean(restorePasswordModal)}
        onClose={() => setRestorePasswordModal(null)}
        title="Descriptografar Backup"
        subtitle="Este arquivo está protegido com senha AES-GCM"
      >
        <form onSubmit={handleConfirmRestoreEncrypted} className="space-y-4">
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Senha do backup</label>
            <Input
              type="password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              placeholder="Digite a senha usada na exportação"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRestorePasswordModal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Restaurar Dados</Button>
          </div>
        </form>
      </Modal>

      {/* Wipe Personal Data Modal */}
      <Modal
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title="Confirmar Limpeza dos Registros"
        subtitle={`Apenas o histórico pessoal de ${activeUser.displayName} será apagado`}
      >
        <form onSubmit={handleConfirmWipe} className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>
              Todas as refeições, glicemias, insulinas e receitas deste perfil serão
              removidas deste dispositivo. Digite <strong>APAGAR</strong> para confirmar.
            </span>
          </div>
          <Input
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
            placeholder="Digite APAGAR"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWipeOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={wipeConfirmText.trim().toUpperCase() !== 'APAGAR'}
            >
              Limpar Registros
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        title="Excluir Conta Local"
        subtitle={`Conta: ${activeUser.fullName}`}
      >
        <form onSubmit={handleConfirmDeleteAccount} className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>
              Esta ação exclui permanentemente o perfil de{' '}
              <strong>{activeUser.displayName}</strong> e todos os dados associados (refeições,
              glicemias, insulinas, receitas e favoritos). Digite <strong>EXCLUIR</strong> para
              confirmar.
            </span>
          </div>
          <Input
            value={deleteAccountConfirm}
            onChange={(e) => setDeleteAccountConfirm(e.target.value)}
            placeholder="Digite EXCLUIR"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteAccountOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={deleteAccountConfirm.trim().toUpperCase() !== 'EXCLUIR'}
            >
              Excluir Conta Permanentemente
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual & Installation Modal */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Manual de Utilização & Instalação"
        subtitle="Guia completo para Android, Windows 10 e Windows 11"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
          <div>
            <h3 className="font-bold text-[#FF243D] mb-1">1. Como usar o CarbControl</h3>
            <p>
              Pesquise alimentos no <strong>Banco Multibase</strong> (TBCA/USP, TACO e USDA FDC) ou
              no <strong>Contador de Carboidratos</strong>, escolha a medida caseira documentada ou
              peso em gramas e adicione à refeição no <strong>Diário Alimentar</strong>. O cálculo
              segue estritamente: <code>(peso em gramas × carboidratos por 100 g) / 100</code>.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-[#FF243D] mb-1">2. Perfis Locais e Privacidade</h3>
            <p>
              Cada conta cadastrada possui seus próprios registros de refeições, glicemia, insulina,
              receitas e backups individuais no dispositivo, protegidos localmente por hash PBKDF2.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-[#FF243D] mb-1">3. Instalação no Windows / Android (PWA)</h3>
            <p>
              Clique no ícone de instalação na barra do navegador ou em{' '}
              <strong>Instalar Aplicativo</strong> para usar em janela própria e modo 100% offline.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setManualOpen(false)}>
              Fechar Manual
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
