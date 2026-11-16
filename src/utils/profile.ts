import type {UserProfile} from '../types';
import {generateSaltBase64, hashPin} from './crypto';
import {generateId} from './format';

const ACTIVE_USER_STORAGE_KEY = 'cc_active_user_id';

export function getStoredActiveUserId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveUserId(userId: string | null): void {
  try {
    if (userId) {
      window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota/privacy errors
  }
}

export async function resizeProfileImageFile(file: File, maxDim = 256): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Imagem inválida ou corrompida.'));
    img.src = dataUrl;
  });
}

export interface CreateUserProfileInput {
  fullName: string;
  displayName: string;
  birthDate: string;
  password: string;
  sex?: 'feminino' | 'masculino' | 'outro' | 'nao_informar';
  heightCm?: number;
  avatarDataUrl?: string;
  diabetesType?: string;
  diagnosisDate?: string;
  treatmentType?: string;
  personalNotes?: string;
  extraHealthInfo?: string;
  dateFormat?: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  notificationsEnabled?: boolean;
  highContrastMode?: boolean;
}

export async function createHashedUserProfile(
  input: CreateUserProfileInput
): Promise<UserProfile> {
  const nowIso = new Date().toISOString();
  const salt = generateSaltBase64();
  const passwordHash = await hashPin(input.password, salt);

  return {
    id: generateId('usr'),
    fullName: input.fullName.trim(),
    displayName: input.displayName.trim(),
    birthDate: input.birthDate,
    sex: input.sex,
    heightCm: input.heightCm,
    avatarDataUrl: input.avatarDataUrl,
    diabetesType: input.diabetesType?.trim() || undefined,
    diagnosisDate: input.diagnosisDate?.trim() || undefined,
    treatmentType: input.treatmentType?.trim() || undefined,
    personalNotes: input.personalNotes?.trim() || undefined,
    extraHealthInfo: input.extraHealthInfo?.trim() || undefined,
    glucoseUnit: 'mg/dL',
    language: 'pt-BR',
    dateFormat: input.dateFormat ?? 'DD/MM/YYYY',
    notificationsEnabled: input.notificationsEnabled ?? false,
    highContrastMode: input.highContrastMode ?? false,
    darkMode: true,
    preferredUnit: 'caseira',
    passwordHash,
    passwordSalt: salt,
    pinEnabled: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
