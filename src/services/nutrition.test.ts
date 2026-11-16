import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_FOODS, SEED_FOOD_MEASURES} from '../database/seed';
import {calculateRecipeTotals, summarizeDailyMeals, summarizeMealItems} from './calculator';
import {calculateFoodPortion, searchFoods} from './nutrition';
import {
  assessFoodQuality,
  formatOptionalNutrient,
  getEquivalentFoods,
  unifiedFoodSearch,
  validateCatalogImportPayload,
} from './nutritionEngine';
import {
  glucoseInputSchema,
  insulinInputSchema,
  quantityInputSchema,
  userRegistrationSchema,
} from './validation';
import {calculateAgeFromBirthDate} from '../utils/date';
import type {Food, MealItem} from '../types';

test('calculates documented TBCA white rice 4 tablespoons accurately (80 g -> 23.08 g carbs)', () => {
  const rice = SEED_FOODS.find((f) => f.id === 'food_arroz_branco_cozido')!;
  const measures = SEED_FOOD_MEASURES.filter((m) => m.foodId === rice.id);
  const result = calculateFoodPortion(rice, measures, 4, 'colher_sopa');

  assert.equal(result.conversionAvailable, true);
  assert.equal(result.totalGrams, 80);
  assert.equal(result.totalCarbs, 23.08);
  assert.equal(result.totalCalories, 104);
  assert.equal(result.carbsPerSingleUnit, 5.77);
});

test('refuses unknown household measure rather than guessing universal spoon weights', () => {
  const chicken = SEED_FOODS.find((f) => f.id === 'food_frango_grelhado')!;
  const measures = SEED_FOOD_MEASURES.filter((m) => m.foodId === chicken.id);
  const result = calculateFoodPortion(chicken, measures, 2, 'xicara');

  assert.equal(result.conversionAvailable, false);
  assert.equal(result.totalCarbs, null);
  assert.match(result.conversionError || '', /Conversão não documentada/);
});

test('rejects zero, negative, and NaN quantities safely', () => {
  const banana = SEED_FOODS.find((f) => f.id === 'food_banana_prata')!;
  const measures = SEED_FOOD_MEASURES.filter((m) => m.foodId === banana.id);

  assert.equal(calculateFoodPortion(banana, measures, 0, 'unidade').conversionAvailable, false);
  assert.equal(calculateFoodPortion(banana, measures, -3, 'unidade').conversionAvailable, false);
  assert.equal(calculateFoodPortion(banana, measures, Number.NaN, 'grama').conversionAvailable, false);
  assert.equal(quantityInputSchema.safeParse(0).success, false);
  assert.equal(quantityInputSchema.safeParse(-5).success, false);
});

test('rejects foods missing nutritional source reference', () => {
  const brokenFood: Food = {
    ...SEED_FOODS[0],
    sourceName: '',
  };
  const res = calculateFoodPortion(brokenFood, [], 100, 'grama');
  assert.equal(res.conversionAvailable, false);
  assert.match(res.conversionError || '', /Referência nutricional ausente/);
});

test('keeps raw and cooked rice separated in search and composition', () => {
  const results = searchFoods(SEED_FOODS, 'arroz branco');
  const cooked = results.find((f) => f.preparation === 'cozido');
  const raw = results.find((f) => f.preparation === 'cru');

  assert.ok(cooked);
  assert.ok(raw);
  assert.notEqual(cooked.carbsTotalPer100g, raw.carbsTotalPer100g);
});

test('unifiedFoodSearch prioritizes TBCA > TACO > USDA and searches popular, scientific, brand & ingredients', () => {
  // Priority order for equivalent "Arroz branco cozido" (TBCA before USDA)
  const riceResults = unifiedFoodSearch(SEED_FOODS, {query: 'arroz branco cozido'});
  assert.ok(riceResults.length >= 2);
  assert.equal(riceResults[0].sourceId, 'src_tbca');

  // Popular name ("aipim" -> Mandioca)
  const cassava = unifiedFoodSearch(SEED_FOODS, {query: 'aipim'});
  assert.ok(cassava.some((f) => f.id === 'food_mandioca_cozida'));

  // Scientific name ("Chenopodium quinoa")
  const quinoa = unifiedFoodSearch(SEED_FOODS, {query: 'Chenopodium'});
  assert.ok(quinoa.some((f) => f.sourceId === 'src_usda'));

  // Accent-insensitive ("salmao" -> Salmão)
  const salmon = unifiedFoodSearch(SEED_FOODS, {query: 'salmao'});
  assert.ok(salmon.length >= 1);
});

test('never substitutes missing optional nutrients with zero and supports equivalence linking', () => {
  const incompleteFood: Food = {
    ...SEED_FOODS[0],
    id: 'food_partial',
    carbsAvailablePer100g: undefined,
    fiberPer100g: undefined,
    caloriesPer100g: undefined,
  };
  const calc = calculateFoodPortion(incompleteFood, [], 100, 'grama');
  assert.equal(calc.availableCarbs, null);
  assert.equal(calc.totalCalories, null);
  assert.equal(formatOptionalNutrient(incompleteFood.fiberPer100g), 'Não informado');

  const quality = assessFoodQuality(incompleteFood);
  assert.equal(quality.hasAvailableCarbs, false);
  assert.ok(quality.completenessPercent < 100);

  const tbcaRice = SEED_FOODS.find((f) => f.id === 'food_arroz_branco_cozido')!;
  const equivalents = getEquivalentFoods(tbcaRice, SEED_FOODS);
  assert.ok(equivalents.some((e) => e.sourceId === 'src_taco'));
});

test('validates offline catalog import payload structure cleanly', () => {
  const validJson = JSON.stringify({
    sourceCode: 'TBCA-TEST',
    sourceName: 'TBCA/USP',
    version: 'v7.2',
    foods: [
      {
        name: 'Inhame cozido',
        altNames: ['cará'],
        category: 'Cereais e tubérculos',
        description: 'Inhame cozido sem sal',
        preparation: 'cozido',
        carbsTotalPer100g: 27.6,
        sourceId: 'src_tbca',
        sourceName: 'TBCA/USP',
        referenceCode: 'BRC9999X',
        sourceVersion: 'v7.2',
        acquisitionMethod: 'Importação JSON autorizada',
        licenseStatus: 'Uso informacional / atribuição TBCA',
        reliability: 'oficial',
        measures: [],
      },
    ],
  });
  const parsed = validateCatalogImportPayload(validJson);
  assert.equal(parsed.foods.length, 1);
  assert.throws(() => validateCatalogImportPayload('{invalid'), /JSON malformado/);
});

test('aggregates meal items and daily meal totals accurately with userId scoping', () => {
  const sampleItems: MealItem[] = [
    {
      id: '1',
      userId: 'usr_gabriel',
      mealId: 'usr_gabriel_2026-11-16_cafe_manha',
      date: '2026-11-16',
      mealType: 'cafe_manha',
      foodNameSnapshot: 'Pão francês',
      preparationSnapshot: 'assado',
      sourceSnapshot: 'TACO',
      referenceCodeSnapshot: 'TACO-016',
      carbsPer100gSnapshot: 50.4,
      availableCarbsPer100gSnapshot: 48.1,
      quantity: 1,
      unitKey: 'unidade',
      unitLabel: 'unidade (50 g)',
      gramsPerUnitSnapshot: 50,
      totalGrams: 50,
      totalCarbs: 25.2,
      availableCarbs: 24.05,
      totalCalories: 136,
      createdAt: '2026-11-16T08:00:00Z',
    },
    {
      id: '2',
      userId: 'usr_gabriel',
      mealId: 'usr_gabriel_2026-11-16_almoco',
      date: '2026-11-16',
      mealType: 'almoco',
      foodNameSnapshot: 'Arroz branco cozido',
      preparationSnapshot: 'cozido',
      sourceSnapshot: 'TBCA/USP',
      referenceCodeSnapshot: 'BRC0018A',
      carbsPer100gSnapshot: 28.85,
      availableCarbsPer100gSnapshot: 27.9,
      quantity: 4,
      unitKey: 'colher_sopa',
      unitLabel: 'colher de sopa',
      gramsPerUnitSnapshot: 20,
      totalGrams: 80,
      totalCarbs: 23.08,
      availableCarbs: 22.32,
      totalCalories: 104,
      createdAt: '2026-11-16T12:00:00Z',
    },
  ];

  const mealSum = summarizeMealItems([sampleItems[0]]);
  assert.equal(mealSum.totalCarbs, 25.2);

  const daily = summarizeDailyMeals(sampleItems);
  assert.equal(daily.totalMealsWithItems, 2);
  assert.equal(daily.totalCarbs, 48.28);
  assert.equal(daily.byMeal.cafe_manha.totalCarbs, 25.2);
  assert.equal(daily.byMeal.almoco.totalCarbs, 23.08);
  assert.equal(daily.byMeal.jantar.itemCount, 0);
});

test('calculates recipe per-serving carbohydrates accurately', () => {
  const totals = calculateRecipeTotals(
    [
      {totalGrams: 45, totalCarbs: 29.97, totalCalories: 177.3},
      {totalGrams: 70, totalCarbs: 15.4, totalCalories: 68.6},
      {totalGrams: 100, totalCarbs: 0.6, totalCalories: 146},
    ],
    2
  );

  assert.equal(totals.totalWeightGrams, 215);
  assert.equal(totals.totalCarbs, 45.97);
  assert.equal(totals.carbsPerServing, 22.99);
  assert.equal(totals.caloriesPerServing, 195.95);
});

test('calculates age automatically from birthDate and validates optional-health registration', () => {
  assert.equal(calculateAgeFromBirthDate('1995-05-15', '2026-11-16'), 31);
  assert.equal(calculateAgeFromBirthDate('1995-12-20', '2026-11-16'), 30);
  assert.equal(calculateAgeFromBirthDate('2030-01-01', '2026-11-16'), null);

  assert.equal(
    userRegistrationSchema.safeParse({
      fullName: 'Maria Clara',
      displayName: 'Maria',
      birthDate: '1992-03-10',
      password: 'segredo123',
    }).success,
    true
  );
  assert.equal(
    userRegistrationSchema.safeParse({
      fullName: 'A',
      displayName: 'A',
      birthDate: '1992-03-10',
      password: '12',
    }).success,
    false
  );
});

test('validates glucose and insulin clinical logging schemas', () => {
  assert.equal(
    glucoseInputSchema.safeParse({
      date: '2026-11-16',
      time: '14:30',
      valueMgDl: 112,
      context: 'apos_2h',
    }).success,
    true
  );
  assert.equal(
    glucoseInputSchema.safeParse({
      date: '2026-11-16',
      time: '14:30',
      valueMgDl: 5,
      context: 'jejum',
    }).success,
    false
  );
  assert.equal(
    insulinInputSchema.safeParse({
      date: '2026-11-16',
      time: '12:00',
      insulinType: 'Ultrarrápida',
      units: 4,
    }).success,
    true
  );
  assert.equal(
    insulinInputSchema.safeParse({
      date: '2026-11-16',
      time: '12:00',
      insulinType: 'Regular',
      units: -2,
    }).success,
    false
  );
});
