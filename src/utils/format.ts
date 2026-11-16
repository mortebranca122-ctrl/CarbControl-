import type {FoodPreparation, FoodReliability, GlucoseContext, MealType} from '../types';

export const MEAL_TYPE_ORDER: MealType[] = [
  'cafe_manha',
  'lanche_manha',
  'almoco',
  'lanche_tarde',
  'jantar',
  'ceia',
];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  cafe_manha: 'Café da Manhã',
  lanche_manha: 'Lanche da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

export const GLUCOSE_CONTEXT_LABELS: Record<GlucoseContext, string> = {
  jejum: 'Jejum',
  antes_refeicao: 'Antes da refeição',
  apos_2h: '2h após a refeição',
  aleatoria: 'Aleatória',
  antes_dormir: 'Antes de dormir',
};

export const PREPARATION_LABELS: Record<FoodPreparation, string> = {
  cozido: 'Cozido',
  cru: 'Cru / In natura',
  assado: 'Assado',
  grelhado: 'Grelhado',
  frito: 'Frito',
  pronto: 'Pronto para consumo',
  industrializado: 'Industrializado (rótulo)',
  congelado: 'Congelado',
  enlatado: 'Enlatado / Conserva',
};

export const RELIABILITY_LABELS: Record<FoodReliability, string> = {
  oficial: 'Fonte Oficial',
  rotulo: 'Rótulo do Fabricante',
  calculado: 'Calculado',
  usuario: 'Informado pelo Usuário',
  estimado: 'Estimado',
};

export function formatDecimalPtBr(value: number, decimals = 1): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCarbs(value: number, decimals = 1): string {
  return `${formatDecimalPtBr(value, decimals)} g`;
}

export function formatGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const decimals = Number.isInteger(rounded) ? 0 : 1;
  return `${formatDecimalPtBr(rounded, decimals)} g`;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function generateId(prefix = 'cc'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
