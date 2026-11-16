import {z} from 'zod';
import {db} from '../database/schema';
import type {
  CatalogImportLog,
  Food,
  FoodCategory,
  FoodMeasure,
  FoodPreparation,
  FoodReliability,
  FoodSource,
} from '../types';
import {generateId} from '../utils/format';
import {
  foodCategorySchema,
  foodPreparationSchema,
  measureUnitKeySchema,
} from './validation';

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const SOURCE_PRIORITY_ORDER: Record<string, number> = {
  src_tbca: 1,
  src_taco: 2,
  src_usda: 3,
  src_rotulo: 4,
  src_manual: 5,
};

export function getSourcePriority(food: Food): number {
  if (SOURCE_PRIORITY_ORDER[food.sourceId] !== undefined) {
    return SOURCE_PRIORITY_ORDER[food.sourceId];
  }
  const s = normalizeSearchText(food.sourceName);
  if (s.includes('tbca')) return 1;
  if (s.includes('taco')) return 2;
  if (s.includes('usda')) return 3;
  if (s.includes('rotulo')) return 4;
  return 5;
}

export interface UnifiedSearchOptions {
  query?: string;
  category?: FoodCategory | 'Todos';
  sourceId?: string | 'Todas';
  preparation?: FoodPreparation | 'Todas';
  reliability?: FoodReliability | 'Todas';
}

/**
 * Unified Nutrition Data Engine search:
 * - Case- and accent-insensitive
 * - Searches name, popularNames, altNames, scientificName, brand, barcode, category,
 *   subCategory, ingredientsText, preparation, description, sourceName, referenceCode
 * - Ranks exact prefix matches and TBCA > TACO > USDA priority while preserving separate preparations
 */
export function unifiedFoodSearch(
  foods: Food[],
  options: UnifiedSearchOptions = {}
): Food[] {
  const {
    query = '',
    category = 'Todos',
    sourceId = 'Todas',
    preparation = 'Todas',
    reliability = 'Todas',
  } = options;

  const normQuery = normalizeSearchText(query);
  const tokens = normQuery ? normQuery.split(/\s+/).filter(Boolean) : [];

  const matched = foods.filter((food) => {
    if (category !== 'Todos' && food.category !== category) return false;
    if (sourceId !== 'Todas' && food.sourceId !== sourceId) return false;
    if (preparation !== 'Todas' && food.preparation !== preparation) return false;
    if (reliability !== 'Todas' && food.reliability !== reliability) return false;

    if (tokens.length === 0) return true;

    const haystack = normalizeSearchText(
      [
        food.name,
        ...(food.altNames ?? []),
        ...(food.popularNames ?? []),
        food.scientificName ?? '',
        food.brand ?? '',
        food.barcode ?? '',
        food.category,
        food.subCategory ?? '',
        food.ingredientsText ?? '',
        food.preparation,
        food.description,
        food.sourceName,
        food.referenceCode,
      ].join(' ')
    );

    return tokens.every((t) => haystack.includes(t));
  });

  return matched.sort((a, b) => {
    if (normQuery) {
      const aName = normalizeSearchText(a.name);
      const bName = normalizeSearchText(b.name);
      const aStarts = aName.startsWith(normQuery) ? 0 : 1;
      const bStarts = bName.startsWith(normQuery) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
    }

    const prioDiff = getSourcePriority(a) - getSourcePriority(b);
    if (prioDiff !== 0) return prioDiff;

    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function groupFoodsBySourceAndPrep(
  foods: Food[]
): Array<{groupKey: string; sourceName: string; preparation: FoodPreparation; items: Food[]}> {
  const map = new Map<
    string,
    {groupKey: string; sourceName: string; preparation: FoodPreparation; items: Food[]}
  >();

  for (const f of foods) {
    const groupKey = `${f.sourceName}__${f.preparation}`;
    const existing = map.get(groupKey);
    if (existing) {
      existing.items.push(f);
    } else {
      map.set(groupKey, {
        groupKey,
        sourceName: f.sourceName,
        preparation: f.preparation,
        items: [f],
      });
    }
  }

  return Array.from(map.values());
}

export function getEquivalentFoods(target: Food, catalog: Food[]): Food[] {
  if (!target.equivalenceGroupId) return [];
  return catalog
    .filter(
      (f) => f.id !== target.id && f.equivalenceGroupId === target.equivalenceGroupId
    )
    .sort((a, b) => getSourcePriority(a) - getSourcePriority(b));
}

export interface FoodQualityAssessment {
  reliabilityLabel: string;
  completenessPercent: number;
  populatedFields: number;
  totalTrackedFields: number;
  hasAvailableCarbs: boolean;
  warning?: string;
}

export function assessFoodQuality(food: Food): FoodQualityAssessment {
  const tracked = [
    food.carbsTotalPer100g,
    food.carbsAvailablePer100g,
    food.fiberPer100g,
    food.sugarPer100g,
    food.proteinPer100g,
    food.totalFatPer100g,
    food.saturatedFatPer100g,
    food.caloriesPer100g,
  ];
  const populatedFields = tracked.filter(
    (v) => typeof v === 'number' && Number.isFinite(v)
  ).length;
  const completenessPercent = Math.round((populatedFields / tracked.length) * 100);

  const reliabilityLabels: Record<FoodReliability, string> = {
    oficial: 'Dado de fonte oficial',
    rotulo: 'Dado de rótulo do fabricante',
    calculado: 'Dado calculado por ingredientes',
    usuario: 'Dado informado pelo usuário',
    estimado: 'Dado estimado (conferir rótulo)',
  };

  let warning: string | undefined;
  if (food.reliability === 'usuario') {
    warning = 'Cadastro local informado pelo usuário — não equivale a tabela científica.';
  } else if (food.reliability === 'estimado' || food.isEstimated) {
    warning = 'Registro marcado como estimado. Confirme com o rótulo ou tabela oficial.';
  }

  return {
    reliabilityLabel: reliabilityLabels[food.reliability] ?? 'Informação local',
    completenessPercent,
    populatedFields,
    totalTrackedFields: tracked.length,
    hasAvailableCarbs: typeof food.carbsAvailablePer100g === 'number',
    warning,
  };
}

const catalogImportItemSchema = z.object({
  name: z.string().trim().min(2),
  altNames: z.array(z.string()).default([]),
  popularNames: z.array(z.string()).optional(),
  scientificName: z.string().optional(),
  brand: z.string().optional(),
  subCategory: z.string().optional(),
  category: foodCategorySchema,
  description: z.string().trim().min(2),
  ingredientsText: z.string().optional(),
  preparation: foodPreparationSchema,
  carbsTotalPer100g: z.number().min(0).max(100),
  carbsAvailablePer100g: z.number().min(0).max(100).optional(),
  fiberPer100g: z.number().min(0).max(100).optional(),
  sugarPer100g: z.number().min(0).max(100).optional(),
  proteinPer100g: z.number().min(0).max(100).optional(),
  totalFatPer100g: z.number().min(0).max(100).optional(),
  saturatedFatPer100g: z.number().min(0).max(100).optional(),
  caloriesPer100g: z.number().min(0).max(950).optional(),
  sourceId: z.string().min(2),
  sourceName: z.string().min(2),
  referenceCode: z.string().min(1),
  sourceVersion: z.string().min(1),
  referenceDate: z.string().default('2026-01-01'),
  countryOfOrigin: z.string().optional(),
  acquisitionMethod: z.string().min(2),
  qualityNotes: z.string().optional(),
  licenseStatus: z.string().min(2),
  reliability: z.enum(['oficial', 'rotulo', 'calculado', 'usuario', 'estimado']),
  equivalenceGroupId: z.string().optional(),
  barcode: z.string().optional(),
  measures: z
    .array(
      z.object({
        unitKey: measureUnitKeySchema,
        label: z.string().min(1),
        gramsPerUnit: z.number().positive(),
        isDefault: z.boolean().optional(),
      })
    )
    .default([]),
});

const catalogPackageSchema = z.object({
  sourceCode: z.string().min(2),
  sourceName: z.string().min(2),
  version: z.string().min(1),
  foods: z.array(catalogImportItemSchema).min(1),
});

export function validateCatalogImportPayload(rawJson: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Arquivo de catálogo inválido: JSON malformado.');
  }
  const result = catalogPackageSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Estrutura de catálogo inválida: ${result.error.issues[0]?.message || 'verifique os campos.'}`
    );
  }
  return result.data;
}

export async function importAuthorizedCatalogJson(rawJson: string): Promise<{
  importedCount: number;
  updatedCount: number;
  skippedDuplicates: number;
}> {
  const pkg = validateCatalogImportPayload(rawJson);
  const existingFoods = await db.foods.toArray();
  const byKey = new Map<string, Food>();
  for (const ef of existingFoods) {
    byKey.set(`${ef.sourceId}::${ef.referenceCode}`, ef);
  }

  const nowIso = new Date().toISOString();
  const foodsToPut: Food[] = [];
  const measuresToPut: FoodMeasure[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let skippedDuplicates = 0;

  for (const item of pkg.foods) {
    const key = `${item.sourceId}::${item.referenceCode}`;
    const existing = byKey.get(key);
    const foodId = existing ? existing.id : generateId('food_imp');

    if (existing && existing.sourceVersion === item.sourceVersion) {
      skippedDuplicates += 1;
      continue;
    }

    if (existing) {
      updatedCount += 1;
    } else {
      importedCount += 1;
    }

    foodsToPut.push({
      id: foodId,
      name: item.name,
      altNames: item.altNames,
      popularNames: item.popularNames,
      scientificName: item.scientificName,
      brand: item.brand,
      subCategory: item.subCategory,
      category: item.category,
      description: item.description,
      ingredientsText: item.ingredientsText,
      preparation: item.preparation,
      carbsTotalPer100g: item.carbsTotalPer100g,
      carbsAvailablePer100g: item.carbsAvailablePer100g,
      fiberPer100g: item.fiberPer100g,
      sugarPer100g: item.sugarPer100g,
      proteinPer100g: item.proteinPer100g,
      totalFatPer100g: item.totalFatPer100g,
      saturatedFatPer100g: item.saturatedFatPer100g,
      caloriesPer100g: item.caloriesPer100g,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      referenceCode: item.referenceCode,
      sourceVersion: item.sourceVersion,
      referenceDate: item.referenceDate,
      countryOfOrigin: item.countryOfOrigin,
      acquisitionMethod: item.acquisitionMethod,
      qualityNotes: item.qualityNotes,
      licenseStatus: item.licenseStatus,
      reliability: item.reliability,
      equivalenceGroupId: item.equivalenceGroupId,
      barcode: item.barcode,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    });

    for (const m of item.measures) {
      measuresToPut.push({
        id: generateId('meas'),
        foodId,
        unitKey: m.unitKey,
        label: m.label,
        gramsPerUnit: m.gramsPerUnit,
        isDefault: m.isDefault,
      });
    }
  }

  const logEntry: CatalogImportLog = {
    id: generateId('catlog'),
    sourceCode: pkg.sourceCode,
    sourceName: pkg.sourceName,
    version: pkg.version,
    importedCount,
    updatedCount,
    importedAt: nowIso,
  };

  await db.transaction(
    'rw',
    db.foods,
    db.food_measures,
    db.catalog_imports,
    async () => {
      if (foodsToPut.length) await db.foods.bulkPut(foodsToPut);
      if (measuresToPut.length) await db.food_measures.bulkPut(measuresToPut);
      await db.catalog_imports.put(logEntry);
    }
  );

  return {importedCount, updatedCount, skippedDuplicates};
}

export function formatOptionalNutrient(
  value: number | undefined,
  unit = 'g',
  decimals = 1
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Não informado';
  }
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${unit}`;
}

export function getSourceMetadataLabel(sources: FoodSource[], sourceId: string): string {
  const s = sources.find((src) => src.id === sourceId);
  return s ? `${s.shortName} (${s.version})` : sourceId;
}
