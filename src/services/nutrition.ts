import type {
  CalculationBreakdown,
  Food,
  FoodCategory,
  FoodMeasure,
  MeasureUnitKey,
} from '../types';
import {round2} from '../utils/format';
import {normalizeSearchText, unifiedFoodSearch} from './nutritionEngine';

export const FOOD_CATEGORIES: FoodCategory[] = [
  'Cereais e tubérculos',
  'Frutas',
  'Legumes e verduras',
  'Leguminosas',
  'Carnes e proteínas',
  'Laticínios',
  'Pães e massas',
  'Bebidas',
  'Doces e biscoitos',
  'Temperos, molhos e óleos',
  'Sementes, castanhas e farinhas',
  'Outros',
];

export function normalizeText(text: string): string {
  return normalizeSearchText(text);
}

export function searchFoods(
  foods: Food[],
  query: string,
  category?: FoodCategory | 'Todos'
): Food[] {
  return unifiedFoodSearch(foods, {
    query,
    category: category ?? 'Todos',
  });
}

/**
 * Resolves exact weight in grams for a given food, unit, and quantity.
 * Never assumes universal spoon/cup/ladle weights — requires documented measure or direct weight (g/kg).
 */
export function resolveUnitGrams(
  unitKey: MeasureUnitKey,
  documentedMeasures: FoodMeasure[]
): {gramsPerUnit: number | null; unitLabel: string; error?: string} {
  if (unitKey === 'grama') {
    return {gramsPerUnit: 1, unitLabel: 'gramas (g)'};
  }
  if (unitKey === 'quilograma') {
    return {gramsPerUnit: 1000, unitLabel: 'quilogramas (kg)'};
  }

  const found = documentedMeasures.find((m) => m.unitKey === unitKey);
  if (!found || !(found.gramsPerUnit > 0)) {
    return {
      gramsPerUnit: null,
      unitLabel: unitKey,
      error:
        'Conversão não documentada para esta medida neste alimento. Informe o peso em gramas (g).',
    };
  }

  return {
    gramsPerUnit: found.gramsPerUnit,
    unitLabel: found.label,
  };
}

/**
 * Core documented formula:
 * Carboidratos = (peso em gramas × carboidratos por 100 g) / 100
 * Never fabricates available carbs if carbsAvailablePer100g is missing.
 */
export function calculateFoodPortion(
  food: Food,
  measures: FoodMeasure[],
  quantity: number,
  unitKey: MeasureUnitKey
): CalculationBreakdown {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      quantity,
      unitKey,
      unitLabel: unitKey,
      gramsPerUnit: null,
      totalGrams: null,
      totalCarbs: null,
      availableCarbs: null,
      totalCalories: null,
      carbsPerSingleUnit: null,
      caloriesPerSingleUnit: null,
      conversionAvailable: false,
      conversionError: 'Informe uma quantidade maior que zero.',
    };
  }

  if (
    !Number.isFinite(food.carbsTotalPer100g) ||
    food.carbsTotalPer100g < 0 ||
    !food.sourceName?.trim()
  ) {
    return {
      quantity,
      unitKey,
      unitLabel: unitKey,
      gramsPerUnit: null,
      totalGrams: null,
      totalCarbs: null,
      availableCarbs: null,
      totalCalories: null,
      carbsPerSingleUnit: null,
      caloriesPerSingleUnit: null,
      conversionAvailable: false,
      conversionError: 'Referência nutricional ausente ou inválida para este alimento.',
    };
  }

  const resolved = resolveUnitGrams(unitKey, measures);
  if (resolved.gramsPerUnit === null) {
    return {
      quantity,
      unitKey,
      unitLabel: resolved.unitLabel,
      gramsPerUnit: null,
      totalGrams: null,
      totalCarbs: null,
      availableCarbs: null,
      totalCalories: null,
      carbsPerSingleUnit: null,
      caloriesPerSingleUnit: null,
      conversionAvailable: false,
      conversionError: resolved.error,
    };
  }

  const totalGrams = round2(quantity * resolved.gramsPerUnit);
  const totalCarbs = round2((totalGrams * food.carbsTotalPer100g) / 100);
  const availableCarbs =
    typeof food.carbsAvailablePer100g === 'number'
      ? round2((totalGrams * food.carbsAvailablePer100g) / 100)
      : null;
  const totalCalories =
    food.caloriesPer100g !== undefined
      ? round2((totalGrams * food.caloriesPer100g) / 100)
      : null;

  const carbsPerSingleUnit = round2((resolved.gramsPerUnit * food.carbsTotalPer100g) / 100);
  const caloriesPerSingleUnit =
    food.caloriesPer100g !== undefined
      ? round2((resolved.gramsPerUnit * food.caloriesPer100g) / 100)
      : null;

  return {
    quantity,
    unitKey,
    unitLabel: resolved.unitLabel,
    gramsPerUnit: resolved.gramsPerUnit,
    totalGrams,
    totalCarbs,
    availableCarbs,
    totalCalories,
    carbsPerSingleUnit,
    caloriesPerSingleUnit,
    conversionAvailable: true,
  };
}

export function getAvailableMeasuresForFood(measures: FoodMeasure[]): FoodMeasure[] {
  const hasGrams = measures.some((m) => m.unitKey === 'grama');
  if (hasGrams) return measures;
  return [
    ...measures,
    {
      id: 'virtual_grama',
      foodId: measures[0]?.foodId ?? '',
      unitKey: 'grama',
      label: 'gramas (g)',
      gramsPerUnit: 1,
      isDefault: measures.length === 0,
    },
  ];
}
