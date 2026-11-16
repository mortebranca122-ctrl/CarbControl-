import type {MealItem, MealType, RecipeItem} from '../types';
import {MEAL_TYPE_ORDER, round2} from '../utils/format';

export interface MealTotals {
  mealType: MealType;
  itemCount: number;
  totalGrams: number;
  totalCarbs: number;
  availableCarbs: number;
  totalCalories: number;
}

export interface DailyTotalsSummary {
  totalMealsWithItems: number;
  totalItems: number;
  totalGrams: number;
  totalCarbs: number;
  availableCarbs: number;
  totalCalories: number;
  byMeal: Record<MealType, MealTotals>;
}

export function summarizeMealItems(items: Pick<MealItem, 'totalGrams' | 'totalCarbs' | 'availableCarbs' | 'totalCalories'>[]): {
  totalGrams: number;
  totalCarbs: number;
  availableCarbs: number;
  totalCalories: number;
} {
  let totalGrams = 0;
  let totalCarbs = 0;
  let availableCarbs = 0;
  let totalCalories = 0;

  for (const item of items) {
    totalGrams += item.totalGrams || 0;
    totalCarbs += item.totalCarbs || 0;
    availableCarbs += item.availableCarbs ?? item.totalCarbs ?? 0;
    totalCalories += item.totalCalories || 0;
  }

  return {
    totalGrams: round2(totalGrams),
    totalCarbs: round2(totalCarbs),
    availableCarbs: round2(availableCarbs),
    totalCalories: round2(totalCalories),
  };
}

export function summarizeDailyMeals(items: MealItem[]): DailyTotalsSummary {
  const byMeal = {} as Record<MealType, MealTotals>;

  for (const mealType of MEAL_TYPE_ORDER) {
    const mealItems = items.filter((it) => it.mealType === mealType);
    const summed = summarizeMealItems(mealItems);
    byMeal[mealType] = {
      mealType,
      itemCount: mealItems.length,
      ...summed,
    };
  }

  const totalItems = items.length;
  const totalMealsWithItems = MEAL_TYPE_ORDER.filter((mt) => byMeal[mt].itemCount > 0).length;
  const all = summarizeMealItems(items);

  return {
    totalMealsWithItems,
    totalItems,
    ...all,
    byMeal,
  };
}

export function calculateRecipeTotals(
  items: Pick<RecipeItem, 'totalGrams' | 'totalCarbs' | 'totalCalories'>[],
  servings: number
): {
  totalWeightGrams: number;
  totalCarbs: number;
  carbsPerServing: number;
  caloriesPerServing?: number;
} {
  if (!Number.isInteger(servings) || servings < 1) {
    throw new Error('O número de porções deve ser um inteiro maior ou igual a 1.');
  }

  let totalWeightGrams = 0;
  let totalCarbs = 0;
  let totalCalories = 0;
  let hasCalories = false;

  for (const item of items) {
    totalWeightGrams += item.totalGrams || 0;
    totalCarbs += item.totalCarbs || 0;
    if (typeof item.totalCalories === 'number') {
      totalCalories += item.totalCalories;
      hasCalories = true;
    }
  }

  return {
    totalWeightGrams: round2(totalWeightGrams),
    totalCarbs: round2(totalCarbs),
    carbsPerServing: round2(totalCarbs / servings),
    caloriesPerServing: hasCalories ? round2(totalCalories / servings) : undefined,
  };
}
