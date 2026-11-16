import {describe, expect, it} from 'vitest';
import {SEED_FOODS, SEED_FOOD_MEASURES} from '../src/database/seed';
import {calculateRecipeTotals, summarizeDailyMeals} from '../src/services/calculator';
import {calculateFoodPortion, searchFoods} from '../src/services/nutrition';
import {
  assessFoodQuality,
  formatOptionalNutrient,
  getEquivalentFoods,
  unifiedFoodSearch,
} from '../src/services/nutritionEngine';
import {buildCarbControlPdf} from '../src/services/pdf';
import {
  customFoodInputSchema,
  pinInputSchema,
  userRegistrationSchema,
} from '../src/services/validation';
import {
  decryptPayload,
  encryptPayload,
  generateSaltBase64,
  hashPin,
  verifyPin,
} from '../src/utils/crypto';
import {calculateAgeFromBirthDate, formatDatePtBr} from '../src/utils/date';

describe('CarbControl — Suite Completa de Lógica, Multibase, Perfis e PDF', () => {
  it('calcula porção TBCA de arroz branco cozido (4 colheres = 80g = 23,08g)', () => {
    const rice = SEED_FOODS.find((f) => f.id === 'food_arroz_branco_cozido')!;
    const measures = SEED_FOOD_MEASURES.filter((m) => m.foodId === rice.id);
    const res = calculateFoodPortion(rice, measures, 4, 'colher_sopa');
    expect(res.conversionAvailable).toBe(true);
    expect(res.totalGrams).toBe(80);
    expect(res.totalCarbs).toBe(23.08);
    expect(res.totalCalories).toBe(104);
  });

  it('bloqueia medidas não documentadas e quantidades inválidas', () => {
    const apple = SEED_FOODS.find((f) => f.id === 'food_maca')!;
    const measures = SEED_FOOD_MEASURES.filter((m) => m.foodId === apple.id);
    expect(calculateFoodPortion(apple, measures, 1, 'colher_cha').conversionAvailable).toBe(false);
    expect(calculateFoodPortion(apple, measures, 0, 'unidade').conversionAvailable).toBe(false);
    expect(calculateFoodPortion(apple, measures, -1, 'grama').conversionAvailable).toBe(false);
  });

  it('executa busca multibase TBCA > TACO > USDA e mantém procedência sem inventar zeros', () => {
    expect(SEED_FOODS.length).toBeGreaterThanOrEqual(40);
    const riceMatches = unifiedFoodSearch(SEED_FOODS, {query: 'arroz branco cozido'});
    expect(riceMatches[0].sourceId).toBe('src_tbca');

    const equivs = getEquivalentFoods(riceMatches[0], SEED_FOODS);
    expect(equivs.some((e) => e.sourceId === 'src_taco')).toBe(true);

    expect(formatOptionalNutrient(undefined)).toBe('Não informado');
    expect(assessFoodQuality(riceMatches[0]).completenessPercent).toBeGreaterThan(70);
  });

  it('gera PDF local com cabeçalho CarbControl e tabela de refeições', () => {
    const doc = buildCarbControlPdf({
      title: 'Relatório Diário',
      periodLabel: '16 de Novembro de 2026',
      userName: 'Gabriel',
      days: [
        {
          date: '2026-11-16',
          items: [
            {
              id: 'mi_1',
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
              createdAt: '2026-11-16T12:00:00Z',
            },
          ],
          meals: [],
          glucose: [],
          insulin: [],
        },
      ],
    });
    const output = doc.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(1500);
  });

  it('criptografa backup AES-GCM, valida PBKDF2, idade automática e cadastro sem saúde obrigatória', async () => {
    const salt = generateSaltBase64();
    const hash = await hashPin('SenhaSegura2026', salt);
    expect(await verifyPin('SenhaSegura2026', hash, salt)).toBe(true);
    expect(await verifyPin('1111', hash, salt)).toBe(false);
    expect(pinInputSchema.safeParse('123').success).toBe(false);

    expect(calculateAgeFromBirthDate('1998-06-10', '2026-11-16')).toBe(28);
    expect(formatDatePtBr('2026-11-16', 'DD/MM/YYYY')).toBe('16/11/2026');
    expect(formatDatePtBr('2026-11-16', 'YYYY-MM-DD')).toBe('2026-11-16');

    expect(
      userRegistrationSchema.safeParse({
        fullName: 'Maria Clara',
        displayName: 'Maria',
        birthDate: '1998-06-10',
        password: 'segredo123',
      }).success
    ).toBe(true);

    const payload = JSON.stringify({hello: 'CarbControl', carbs: 23.08});
    const encrypted = await encryptPayload(payload, 'MinhaSenhaForte!');
    expect(encrypted.encrypted).toBe(true);
    const decrypted = await decryptPayload(encrypted, 'MinhaSenhaForte!');
    expect(decrypted).toBe(payload);
    await expect(decryptPayload(encrypted, 'SenhaErrada')).rejects.toThrow();
  });

  it('valida cadastro de alimento e somatórios de diário/receita', () => {
    expect(
      customFoodInputSchema.safeParse({
        name: 'Biscoito de Polvilho',
        category: 'Outros',
        description: 'Rótulo fabricante',
        preparation: 'industrializado',
        carbsTotalPer100g: 75,
        carbsAvailablePer100g: 74,
        sourceName: 'Rótulo',
        referenceCode: 'EAN-123',
      }).success
    ).toBe(true);

    expect(searchFoods(SEED_FOODS, 'feijao').length).toBeGreaterThanOrEqual(2);
    expect(summarizeDailyMeals([]).totalCarbs).toBe(0);
    expect(calculateRecipeTotals([{totalGrams: 100, totalCarbs: 20}], 2).carbsPerServing).toBe(10);
  });
});
