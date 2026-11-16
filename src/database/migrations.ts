import {db, DEFAULT_USER_ID, isOpaqueFileOrigin} from './schema';
import {
  SEED_FOODS,
  SEED_FOOD_MEASURES,
  SEED_FOOD_SOURCES,
  SEED_RECIPES,
  SEED_RECIPE_ITEMS,
  SEED_USER_PROFILES,
} from './seed';
import type {AppSettings, UserProfile} from '../types';

export function makeDefaultSettingsForUser(profile: UserProfile): AppSettings {
  return {
    id: `settings_${profile.id}`,
    userId: profile.id,
    userName: profile.displayName,
    diabetesLabel: profile.diabetesType || 'Acompanhamento Pessoal',
    darkMode: profile.darkMode,
    preferredUnit: profile.preferredUnit,
    language: 'pt-BR',
    pinEnabled: profile.pinEnabled,
    pinHash: profile.pinHash,
    pinSalt: profile.pinSalt,
    lastBackupAt: profile.lastBackupAt,
    updatedAt: new Date().toISOString(),
  };
}

export const DEFAULT_SETTINGS: AppSettings = makeDefaultSettingsForUser(
  SEED_USER_PROFILES[0]
);

let initPromise: Promise<void> | null = null;

async function openDatabaseWithTimeout(timeoutMs = 7000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.open(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              'Tempo esgotado ao abrir o banco local (IndexedDB). Feche outras abas do aplicativo e tente novamente.'
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function openOrRecoverDatabase(): Promise<void> {
  try {
    await openDatabaseWithTimeout();
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    const errMsg = err instanceof Error ? err.message : String(err);
    const isSchemaUpgradeIssue =
      errName === 'UpgradeError' ||
      errName === 'VersionError' ||
      errName === 'SchemaError' ||
      errMsg.includes('changing primary key') ||
      errMsg.includes('UpgradeError');

    if (isSchemaUpgradeIssue) {
      db.close();
      await db.delete();
      await openDatabaseWithTimeout();
      return;
    }
    throw err;
  }
}

const FILE_MODE_SNAPSHOT_KEY = 'cc_file_mode_snapshot_v1';
let fileModeHooksAttached = false;
let fileModeHydrating = false;
let fileModeSaveTimer: ReturnType<typeof setTimeout> | null = null;

const SEED_FOOD_IDS = new Set(SEED_FOODS.map((f) => f.id));
const SEED_MEASURE_IDS = new Set(SEED_FOOD_MEASURES.map((m) => m.id));

async function saveFileModeSnapshotNow(): Promise<void> {
  if (!isOpaqueFileOrigin || fileModeHydrating) return;
  try {
    const [
      users,
      settings,
      daily_records,
      meals,
      meal_items,
      glucose_records,
      insulin_records,
      recipes,
      recipe_items,
      favorites,
      backups_metadata,
      catalog_imports,
      allFoods,
      allMeasures,
    ] = await Promise.all([
      db.users.toArray(),
      db.settings.toArray(),
      db.daily_records.toArray(),
      db.meals.toArray(),
      db.meal_items.toArray(),
      db.glucose_records.toArray(),
      db.insulin_records.toArray(),
      db.recipes.toArray(),
      db.recipe_items.toArray(),
      db.favorites.toArray(),
      db.backups_metadata.toArray(),
      db.catalog_imports.toArray(),
      db.foods.toArray(),
      db.food_measures.toArray(),
    ]);

    const snapshot = {
      users,
      settings,
      daily_records,
      meals,
      meal_items,
      glucose_records,
      insulin_records,
      recipes,
      recipe_items,
      favorites,
      backups_metadata,
      catalog_imports,
      customFoods: allFoods.filter((f) => f.isUserCustom || !SEED_FOOD_IDS.has(f.id)),
      customMeasures: allMeasures.filter((m) => !SEED_MEASURE_IDS.has(m.id)),
    };
    window.localStorage.setItem(FILE_MODE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage quota errors on file://
  }
}

function scheduleFileModeSnapshotSave(): void {
  if (!isOpaqueFileOrigin || fileModeHydrating) return;
  if (fileModeSaveTimer) clearTimeout(fileModeSaveTimer);
  fileModeSaveTimer = setTimeout(() => {
    void saveFileModeSnapshotNow();
  }, 150);
}

function attachFileModePersistenceHooks(): void {
  if (!isOpaqueFileOrigin || fileModeHooksAttached) return;
  fileModeHooksAttached = true;
  const tables = [
    db.users,
    db.settings,
    db.daily_records,
    db.meals,
    db.meal_items,
    db.glucose_records,
    db.insulin_records,
    db.recipes,
    db.recipe_items,
    db.favorites,
    db.backups_metadata,
    db.catalog_imports,
    db.foods,
    db.food_measures,
  ];
  for (const table of tables) {
    table.hook('creating', () => {
      scheduleFileModeSnapshotSave();
    });
    table.hook('updating', () => {
      scheduleFileModeSnapshotSave();
    });
    table.hook('deleting', () => {
      scheduleFileModeSnapshotSave();
    });
  }
}

async function hydrateFileModeSnapshot(): Promise<void> {
  if (!isOpaqueFileOrigin) return;
  try {
    const raw = window.localStorage.getItem(FILE_MODE_SNAPSHOT_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== 'object') return;
    fileModeHydrating = true;
    await db.transaction(
      'rw',
      [
        db.users,
        db.settings,
        db.daily_records,
        db.meals,
        db.meal_items,
        db.glucose_records,
        db.insulin_records,
        db.recipes,
        db.recipe_items,
        db.favorites,
        db.backups_metadata,
        db.catalog_imports,
        db.foods,
        db.food_measures,
      ],
      async () => {
        if (Array.isArray(snap.users) && snap.users.length > 0) await db.users.bulkPut(snap.users);
        if (Array.isArray(snap.settings) && snap.settings.length > 0)
          await db.settings.bulkPut(snap.settings);
        if (Array.isArray(snap.daily_records) && snap.daily_records.length > 0)
          await db.daily_records.bulkPut(snap.daily_records);
        if (Array.isArray(snap.meals) && snap.meals.length > 0) await db.meals.bulkPut(snap.meals);
        if (Array.isArray(snap.meal_items) && snap.meal_items.length > 0)
          await db.meal_items.bulkPut(snap.meal_items);
        if (Array.isArray(snap.glucose_records) && snap.glucose_records.length > 0)
          await db.glucose_records.bulkPut(snap.glucose_records);
        if (Array.isArray(snap.insulin_records) && snap.insulin_records.length > 0)
          await db.insulin_records.bulkPut(snap.insulin_records);
        if (Array.isArray(snap.recipes) && snap.recipes.length > 0)
          await db.recipes.bulkPut(snap.recipes);
        if (Array.isArray(snap.recipe_items) && snap.recipe_items.length > 0)
          await db.recipe_items.bulkPut(snap.recipe_items);
        if (Array.isArray(snap.favorites) && snap.favorites.length > 0)
          await db.favorites.bulkPut(snap.favorites);
        if (Array.isArray(snap.backups_metadata) && snap.backups_metadata.length > 0)
          await db.backups_metadata.bulkPut(snap.backups_metadata);
        if (Array.isArray(snap.catalog_imports) && snap.catalog_imports.length > 0)
          await db.catalog_imports.bulkPut(snap.catalog_imports);
        if (Array.isArray(snap.customFoods) && snap.customFoods.length > 0)
          await db.foods.bulkPut(snap.customFoods);
        if (Array.isArray(snap.customMeasures) && snap.customMeasures.length > 0)
          await db.food_measures.bulkPut(snap.customMeasures);
      }
    );
  } catch {
    // ignore corrupt snapshot
  } finally {
    fileModeHydrating = false;
  }
}

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await openOrRecoverDatabase();

    // Sync/upgrade multibase sources & official seed foods non-destructively
    const usdaSource = await db.food_sources.get('src_usda');
    if (!usdaSource) {
      await db.transaction(
        'rw',
        db.food_sources,
        db.foods,
        db.food_measures,
        async () => {
          await db.food_sources.bulkPut(SEED_FOOD_SOURCES);
          await db.foods.bulkPut(SEED_FOODS);
          await db.food_measures.bulkPut(SEED_FOOD_MEASURES);
        }
      );
    }

    if (isOpaqueFileOrigin) {
      await hydrateFileModeSnapshot();
    }

    // Ensure at least the default local profile exists on fresh install
    const usersCount = await db.users.count();
    if (usersCount === 0) {
      const legacySettings = await db.settings.get('app_settings');
      const baseProfile: UserProfile = {
        ...SEED_USER_PROFILES[0],
        displayName: legacySettings?.userName || SEED_USER_PROFILES[0].displayName,
        fullName: legacySettings?.userName || SEED_USER_PROFILES[0].fullName,
        diabetesType:
          legacySettings?.diabetesLabel || SEED_USER_PROFILES[0].diabetesType,
        darkMode: legacySettings?.darkMode ?? true,
        preferredUnit: legacySettings?.preferredUnit ?? 'caseira',
        pinEnabled: legacySettings?.pinEnabled ?? false,
        pinHash: legacySettings?.pinHash,
        pinSalt: legacySettings?.pinSalt,
        lastBackupAt: legacySettings?.lastBackupAt,
        updatedAt: new Date().toISOString(),
      };

      await db.transaction(
        'rw',
        db.users,
        db.settings,
        db.recipes,
        db.recipe_items,
        async () => {
          await db.users.put(baseProfile);
          await db.settings.put(makeDefaultSettingsForUser(baseProfile));

          const recipeCount = await db.recipes.count();
          if (recipeCount === 0) {
            await db.recipes.bulkPut(SEED_RECIPES);
            await db.recipe_items.bulkPut(SEED_RECIPE_ITEMS);
          }
        }
      );
    }

    if (isOpaqueFileOrigin) {
      attachFileModePersistenceHooks();
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export async function clearUserPersonalData(userId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.daily_records,
      db.meals,
      db.meal_items,
      db.glucose_records,
      db.insulin_records,
      db.recipes,
      db.recipe_items,
      db.favorites,
      db.backups_metadata,
    ],
    async () => {
      await db.daily_records.where('userId').equals(userId).delete();
      await db.meals.where('userId').equals(userId).delete();
      await db.meal_items.where('userId').equals(userId).delete();
      await db.glucose_records.where('userId').equals(userId).delete();
      await db.insulin_records.where('userId').equals(userId).delete();
      await db.recipe_items.where('userId').equals(userId).delete();
      await db.recipes.where('userId').equals(userId).delete();
      await db.favorites.where('userId').equals(userId).delete();
      await db.backups_metadata.where('userId').equals(userId).delete();
    }
  );
}

export async function deleteUserAccountAndData(userId: string): Promise<void> {
  await clearUserPersonalData(userId);
  await db.transaction('rw', db.users, db.settings, async () => {
    await db.settings.where('userId').equals(userId).delete();
    await db.users.delete(userId);
  });
}

export async function resetDatabaseWithSeed(): Promise<void> {
  await clearUserPersonalData(DEFAULT_USER_ID);
  await db.transaction(
    'rw',
    [db.recipes, db.recipe_items, db.users, db.settings],
    async () => {
      await db.users.put(SEED_USER_PROFILES[0]);
      await db.settings.put(makeDefaultSettingsForUser(SEED_USER_PROFILES[0]));
      await db.recipes.bulkPut(SEED_RECIPES);
      await db.recipe_items.bulkPut(SEED_RECIPE_ITEMS);
    }
  );
}
