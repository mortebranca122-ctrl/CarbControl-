import Dexie, {type Table} from 'dexie';
import {IDBKeyRange as FakeIDBKeyRange, indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import type {
  AppSettings,
  BackupMetadata,
  CatalogImportLog,
  DailyRecord,
  FavoriteRecord,
  Food,
  FoodMeasure,
  FoodSource,
  GlucoseRecord,
  InsulinRecord,
  Meal,
  MealItem,
  Recipe,
  RecipeItem,
  UserProfile,
} from '../types';

export const DEFAULT_USER_ID = 'usr_gabriel';

export const isOpaqueFileOrigin =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' || window.origin === 'null');

export class CarbControlDatabase extends Dexie {
  foods!: Table<Food, string>;
  food_measures!: Table<FoodMeasure, string>;
  food_sources!: Table<FoodSource, string>;
  catalog_imports!: Table<CatalogImportLog, string>;
  users!: Table<UserProfile, string>;
  daily_records!: Table<DailyRecord, string>;
  meals!: Table<Meal, string>;
  meal_items!: Table<MealItem, string>;
  glucose_records!: Table<GlucoseRecord, string>;
  insulin_records!: Table<InsulinRecord, string>;
  recipes!: Table<Recipe, string>;
  recipe_items!: Table<RecipeItem, string>;
  favorites!: Table<FavoriteRecord, string>;
  settings!: Table<AppSettings, string>;
  backups_metadata!: Table<BackupMetadata, string>;

  constructor() {
    super(
      'carbcontrol_sukuna_db',
      isOpaqueFileOrigin
        ? {indexedDB: fakeIndexedDB, IDBKeyRange: FakeIDBKeyRange}
        : undefined
    );

    this.version(1).stores({
      foods: 'id, name, category, preparation, sourceId, barcode, isUserCustom',
      food_measures: 'id, foodId, unitKey',
      food_sources: 'id, code, shortName',
      daily_records: 'date',
      meals: 'id, date, mealType, [date+mealType]',
      meal_items: 'id, mealId, date, mealType, foodId, recipeId, [date+mealType]',
      glucose_records: 'id, date, time, context, mealType, [date+time]',
      insulin_records: 'id, date, time, insulinType, mealType, [date+time]',
      recipes: 'id, name, isFavorite',
      recipe_items: 'id, recipeId, foodId',
      favorites: 'id, targetType, targetId, [targetType+targetId]',
      settings: 'id',
      backups_metadata: 'id, exportedAt',
    });

    this.version(2)
      .stores({
        foods:
          'id, name, category, preparation, sourceId, barcode, equivalenceGroupId, reliability, isUserCustom',
        food_measures: 'id, foodId, unitKey',
        food_sources: 'id, code, shortName, priority',
        catalog_imports: 'id, sourceCode, importedAt',
        users: 'id, displayName, fullName, createdAt',
        daily_records: null,
        meals: 'id, userId, date, mealType, [userId+date], [userId+date+mealType]',
        meal_items:
          'id, userId, mealId, date, mealType, foodId, recipeId, [userId+date], [userId+date+mealType]',
        glucose_records: 'id, userId, date, time, context, mealType, [userId+date]',
        insulin_records: 'id, userId, date, time, insulinType, mealType, [userId+date]',
        recipes: 'id, userId, name, isFavorite, [userId+isFavorite]',
        recipe_items: 'id, userId, recipeId, foodId',
        favorites: 'id, userId, targetType, targetId, [userId+targetType+targetId]',
        settings: 'id, userId',
        backups_metadata: 'id, userId, exportedAt',
      })
      .upgrade(async (tx) => {
        const assignUser = (rec: {userId?: string}) => {
          if (!rec.userId) rec.userId = DEFAULT_USER_ID;
        };
        await tx.table('meals').toCollection().modify(assignUser);
        await tx.table('meal_items').toCollection().modify(assignUser);
        await tx.table('glucose_records').toCollection().modify(assignUser);
        await tx.table('insulin_records').toCollection().modify(assignUser);
        await tx.table('recipes').toCollection().modify(assignUser);
        await tx.table('recipe_items').toCollection().modify(assignUser);
        await tx.table('favorites').toCollection().modify(assignUser);
        await tx.table('backups_metadata').toCollection().modify(assignUser);
      });

    this.version(3).stores({
      foods:
        'id, name, category, preparation, sourceId, barcode, equivalenceGroupId, reliability, isUserCustom',
      food_measures: 'id, foodId, unitKey',
      food_sources: 'id, code, shortName, priority',
      catalog_imports: 'id, sourceCode, importedAt',
      users: 'id, displayName, fullName, createdAt',
      daily_records: 'id, userId, date, [userId+date]',
      meals: 'id, userId, date, mealType, [userId+date], [userId+date+mealType]',
      meal_items:
        'id, userId, mealId, date, mealType, foodId, recipeId, [userId+date], [userId+date+mealType]',
      glucose_records: 'id, userId, date, time, context, mealType, [userId+date]',
      insulin_records: 'id, userId, date, time, insulinType, mealType, [userId+date]',
      recipes: 'id, userId, name, isFavorite, [userId+isFavorite]',
      recipe_items: 'id, userId, recipeId, foodId',
      favorites: 'id, userId, targetType, targetId, [userId+targetType+targetId]',
      settings: 'id, userId',
      backups_metadata: 'id, userId, exportedAt',
    });
  }
}

export const db = new CarbControlDatabase();
