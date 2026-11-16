import {z} from 'zod';
import {db} from '../database/schema';
import {decryptPayload, encryptPayload, type EncryptedEnvelope} from '../utils/crypto';
import {generateId} from '../utils/format';

const backupDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  appName: z.literal('CarbControl — Sukuna Edition'),
  userId: z.string().optional(),
  data: z.object({
    profile: z.any().optional(),
    foods: z.array(z.any()),
    food_measures: z.array(z.any()),
    food_sources: z.array(z.any()),
    daily_records: z.array(z.any()),
    meals: z.array(z.any()),
    meal_items: z.array(z.any()),
    glucose_records: z.array(z.any()),
    insulin_records: z.array(z.any()),
    recipes: z.array(z.any()),
    recipe_items: z.array(z.any()),
    favorites: z.array(z.any()),
    settings: z.array(z.any()),
  }),
});

export type BackupPlainPayload = z.infer<typeof backupDataSchema>;

export async function collectBackupPayload(userId: string): Promise<BackupPlainPayload> {
  const [
    profile,
    foods,
    food_measures,
    food_sources,
    daily_records,
    meals,
    meal_items,
    glucose_records,
    insulin_records,
    recipes,
    recipe_items,
    favorites,
    settings,
  ] = await Promise.all([
    db.users.get(userId),
    db.foods.filter((f) => Boolean(f.isUserCustom)).toArray(),
    db.food_measures.toArray(),
    db.food_sources.toArray(),
    db.daily_records.where('userId').equals(userId).toArray(),
    db.meals.where('userId').equals(userId).toArray(),
    db.meal_items.where('userId').equals(userId).toArray(),
    db.glucose_records.where('userId').equals(userId).toArray(),
    db.insulin_records.where('userId').equals(userId).toArray(),
    db.recipes.where('userId').equals(userId).toArray(),
    db.recipe_items.where('userId').equals(userId).toArray(),
    db.favorites.where('userId').equals(userId).toArray(),
    db.settings.where('userId').equals(userId).toArray(),
  ]);

  const customFoodIds = new Set(foods.map((f) => f.id));
  const customMeasures = food_measures.filter((m) => customFoodIds.has(m.foodId));

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appName: 'CarbControl — Sukuna Edition',
    userId,
    data: {
      profile,
      foods,
      food_measures: customMeasures,
      food_sources,
      daily_records,
      meals,
      meal_items,
      glucose_records,
      insulin_records,
      recipes,
      recipe_items,
      favorites,
      settings,
    },
  };
}

export async function exportBackupFile(
  userId: string,
  password?: string
): Promise<{
  content: string;
  filename: string;
  encrypted: boolean;
  itemCount: number;
}> {
  const payload = await collectBackupPayload(userId);
  const itemCount =
    payload.data.meal_items.length +
    payload.data.glucose_records.length +
    payload.data.insulin_records.length +
    payload.data.recipes.length +
    payload.data.foods.length;

  const trimmedPassword = password?.trim();
  const encrypted = Boolean(trimmedPassword);
  const content = encrypted
    ? JSON.stringify(await encryptPayload(JSON.stringify(payload), trimmedPassword!), null, 2)
    : JSON.stringify(payload, null, 2);

  const nowIso = new Date().toISOString();
  await db.backups_metadata.put({
    id: generateId('bkp'),
    userId,
    exportedAt: nowIso,
    itemCount,
    encrypted,
    note: encrypted ? 'Backup individual criptografado (AES-GCM)' : 'Backup individual JSON',
  });

  const user = await db.users.get(userId);
  if (user) {
    await db.users.update(userId, {lastBackupAt: nowIso, updatedAt: nowIso});
  }

  const stamp = nowIso.slice(0, 10);
  const slug = (user?.displayName || 'perfil').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = encrypted
    ? `carbcontrol-${slug}-backup-criptografado-${stamp}.json`
    : `carbcontrol-${slug}-backup-${stamp}.json`;

  return {content, filename, encrypted, itemCount};
}

export function isEncryptedBackupContent(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText);
    return parsed?.format === 'carbcontrol-backup' && parsed?.encrypted === true;
  } catch {
    return false;
  }
}

export async function parseAndRestoreBackup(
  rawText: string,
  targetUserId: string,
  password?: string
): Promise<{restoredCount: number}> {
  let jsonToValidate = rawText;

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawText);
  } catch {
    throw new Error('Arquivo de backup inválido: não é um JSON válido.');
  }

  if (
    typeof parsedRaw === 'object' &&
    parsedRaw !== null &&
    (parsedRaw as Partial<EncryptedEnvelope>).format === 'carbcontrol-backup' &&
    (parsedRaw as Partial<EncryptedEnvelope>).encrypted === true
  ) {
    if (!password?.trim()) {
      throw new Error('Este backup está criptografado. Informe a senha para restaurar.');
    }
    try {
      jsonToValidate = await decryptPayload(parsedRaw as EncryptedEnvelope, password.trim());
    } catch {
      throw new Error('Senha incorreta ou arquivo de backup corrompido.');
    }
  }

  let parsedPlain: unknown;
  try {
    parsedPlain = JSON.parse(jsonToValidate);
  } catch {
    throw new Error('Conteúdo do backup corrompido ou ilegível.');
  }

  const validated = backupDataSchema.safeParse(parsedPlain);
  if (!validated.success) {
    throw new Error('Estrutura do backup incompatível com o CarbControl.');
  }

  const d = validated.data.data;
  const sameOwner = validated.data.userId === targetUserId;

  const recipeIdMap = new Map<string, string>();
  const remappedRecipes = d.recipes.map((r) => {
    const newId = sameOwner ? r.id : generateId('rec');
    if (r.id) recipeIdMap.set(r.id, newId);
    return {...r, id: newId, userId: targetUserId};
  });

  const remappedRecipeItems = d.recipe_items.map((ri) => ({
    ...ri,
    id: sameOwner ? ri.id : generateId('ri'),
    recipeId: recipeIdMap.get(ri.recipeId) ?? ri.recipeId,
    userId: targetUserId,
  }));

  const remappedMeals = d.meals.map((m) => ({
    ...m,
    id: `${targetUserId}_${m.date}_${m.mealType}`,
    userId: targetUserId,
  }));

  const remappedMealItems = d.meal_items.map((mi) => ({
    ...mi,
    id: sameOwner ? mi.id : generateId('mi'),
    mealId: `${targetUserId}_${mi.date}_${mi.mealType}`,
    recipeId: mi.recipeId ? recipeIdMap.get(mi.recipeId) ?? mi.recipeId : undefined,
    userId: targetUserId,
  }));

  const remappedGlucose = d.glucose_records.map((g) => ({
    ...g,
    id: sameOwner ? g.id : generateId('glc'),
    userId: targetUserId,
  }));

  const remappedInsulin = d.insulin_records.map((ins) => ({
    ...ins,
    id: sameOwner ? ins.id : generateId('ins'),
    userId: targetUserId,
  }));

  const remappedFavorites = d.favorites.map((fav) => ({
    ...fav,
    id: sameOwner ? fav.id : generateId('fav'),
    targetId:
      fav.targetType === 'recipe'
        ? recipeIdMap.get(fav.targetId) ?? fav.targetId
        : fav.targetId,
    userId: targetUserId,
  }));

  await db.transaction(
    'rw',
    [
      db.foods,
      db.food_measures,
      db.daily_records,
      db.meals,
      db.meal_items,
      db.glucose_records,
      db.insulin_records,
      db.recipes,
      db.recipe_items,
      db.favorites,
    ],
    async () => {
      await Promise.all([
        db.daily_records.where('userId').equals(targetUserId).delete(),
        db.meals.where('userId').equals(targetUserId).delete(),
        db.meal_items.where('userId').equals(targetUserId).delete(),
        db.glucose_records.where('userId').equals(targetUserId).delete(),
        db.insulin_records.where('userId').equals(targetUserId).delete(),
        db.recipes.where('userId').equals(targetUserId).delete(),
        db.recipe_items.where('userId').equals(targetUserId).delete(),
        db.favorites.where('userId').equals(targetUserId).delete(),
      ]);

      if (d.foods.length) await db.foods.bulkPut(d.foods);
      if (d.food_measures.length) await db.food_measures.bulkPut(d.food_measures);
      if (d.daily_records.length) {
        await db.daily_records.bulkPut(
          d.daily_records.map((dr) => ({
            ...dr,
            id: `${targetUserId}_${dr.date}`,
            userId: targetUserId,
          }))
        );
      }
      if (remappedMeals.length) await db.meals.bulkPut(remappedMeals);
      if (remappedMealItems.length) await db.meal_items.bulkPut(remappedMealItems);
      if (remappedGlucose.length) await db.glucose_records.bulkPut(remappedGlucose);
      if (remappedInsulin.length) await db.insulin_records.bulkPut(remappedInsulin);
      if (remappedRecipes.length) await db.recipes.bulkPut(remappedRecipes);
      if (remappedRecipeItems.length) await db.recipe_items.bulkPut(remappedRecipeItems);
      if (remappedFavorites.length) await db.favorites.bulkPut(remappedFavorites);
    }
  );

  return {
    restoredCount:
      d.meal_items.length +
      d.glucose_records.length +
      d.insulin_records.length +
      d.recipes.length,
  };
}
