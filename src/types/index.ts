export type FoodCategory =
  | 'Cereais e tubérculos'
  | 'Frutas'
  | 'Legumes e verduras'
  | 'Leguminosas'
  | 'Carnes e proteínas'
  | 'Laticínios'
  | 'Pães e massas'
  | 'Bebidas'
  | 'Doces e biscoitos'
  | 'Temperos, molhos e óleos'
  | 'Sementes, castanhas e farinhas'
  | 'Outros';

export type FoodPreparation =
  | 'cozido'
  | 'cru'
  | 'assado'
  | 'grelhado'
  | 'frito'
  | 'pronto'
  | 'industrializado'
  | 'congelado'
  | 'enlatado';

export type MeasureUnitKey =
  | 'grama'
  | 'quilograma'
  | 'colher_sopa'
  | 'colher_cha'
  | 'xicara'
  | 'copo'
  | 'concha'
  | 'fatia'
  | 'unidade'
  | 'porcao'
  | 'mililitro'
  | 'prato'
  | 'pote';

export type MealType =
  | 'cafe_manha'
  | 'lanche_manha'
  | 'almoco'
  | 'lanche_tarde'
  | 'jantar'
  | 'ceia';

export type GlucoseContext =
  | 'jejum'
  | 'antes_refeicao'
  | 'apos_2h'
  | 'aleatoria'
  | 'antes_dormir';

export type FoodReliability =
  | 'oficial'
  | 'rotulo'
  | 'calculado'
  | 'usuario'
  | 'estimado';

export interface FoodSource {
  id: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  version: string;
  country: string;
  licenseStatus: string;
  priority: number; // 1=TBCA, 2=TACO, 3=USDA, 4=Rótulo, 5=Manual
}

export interface FoodMeasure {
  id: string;
  foodId: string;
  unitKey: MeasureUnitKey;
  label: string;
  gramsPerUnit: number;
  isDefault?: boolean;
}

export interface Food {
  id: string;
  name: string;
  altNames: string[];
  popularNames?: string[];
  scientificName?: string;
  brand?: string;
  subCategory?: string;
  category: FoodCategory;
  description: string;
  ingredientsText?: string;
  preparation: FoodPreparation;
  // Macronutrients per 100g (undefined = unavailable, never substituted with 0)
  carbsTotalPer100g: number;
  carbsAvailablePer100g?: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  proteinPer100g?: number;
  totalFatPer100g?: number;
  saturatedFatPer100g?: number;
  caloriesPer100g?: number;
  // Provenance & quality control
  sourceId: string;
  sourceName: string;
  referenceCode: string;
  sourceVersion: string;
  referenceDate: string;
  countryOfOrigin?: string;
  acquisitionMethod: string;
  qualityNotes?: string;
  licenseStatus: string;
  reliability: FoodReliability;
  equivalenceGroupId?: string;
  barcode?: string;
  imageUrl?: string;
  isEstimated?: boolean;
  isUserCustom?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogImportLog {
  id: string;
  sourceCode: string;
  sourceName: string;
  version: string;
  importedCount: number;
  updatedCount: number;
  importedAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  displayName: string;
  birthDate: string; // YYYY-MM-DD
  sex?: 'feminino' | 'masculino' | 'outro' | 'nao_informar';
  heightCm?: number;
  avatarDataUrl?: string;
  // Optional health info
  diabetesType?: string;
  diagnosisDate?: string;
  treatmentType?: string;
  personalNotes?: string;
  extraHealthInfo?: string;
  // Preferences
  glucoseUnit: 'mg/dL';
  language: 'pt-BR';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  notificationsEnabled: boolean;
  highContrastMode: boolean;
  darkMode: boolean;
  preferredUnit: 'g' | 'caseira';
  // Security (PBKDF2-SHA256)
  passwordHash?: string;
  passwordSalt?: string;
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  lastBackupAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRecord {
  id: string; // `${userId}_${date}`
  userId: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  updatedAt: string;
}

export interface Meal {
  id: string; // `${userId}_${date}_${mealType}`
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  notes?: string;
  updatedAt: string;
}

export interface MealItem {
  id: string;
  userId: string;
  mealId: string;
  date: string;
  mealType: MealType;
  foodId?: string;
  recipeId?: string;
  foodNameSnapshot: string;
  preparationSnapshot: string;
  sourceSnapshot: string;
  referenceCodeSnapshot: string;
  carbsPer100gSnapshot: number;
  availableCarbsPer100gSnapshot?: number;
  caloriesPer100gSnapshot?: number;
  quantity: number;
  unitKey: MeasureUnitKey;
  unitLabel: string;
  gramsPerUnitSnapshot: number;
  totalGrams: number;
  totalCarbs: number;
  availableCarbs: number;
  totalCalories?: number;
  createdAt: string;
}

export interface GlucoseRecord {
  id: string;
  userId: string;
  date: string;
  time: string; // HH:mm
  valueMgDl: number;
  context: GlucoseContext;
  mealType?: MealType;
  notes?: string;
  createdAt: string;
}

export interface InsulinRecord {
  id: string;
  userId: string;
  date: string;
  time: string; // HH:mm
  insulinType: string;
  units: number;
  mealType?: MealType;
  notes?: string;
  createdAt: string;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  description?: string;
  servings: number;
  imageUrl?: string;
  isFavorite: boolean;
  totalWeightGrams: number;
  totalCarbs: number;
  carbsPerServing: number;
  caloriesPerServing?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeItem {
  id: string;
  userId: string;
  recipeId: string;
  foodId: string;
  foodNameSnapshot: string;
  sourceSnapshot: string;
  referenceCodeSnapshot: string;
  carbsPer100gSnapshot: number;
  caloriesPer100gSnapshot?: number;
  quantity: number;
  unitKey: MeasureUnitKey;
  unitLabel: string;
  gramsPerUnitSnapshot: number;
  totalGrams: number;
  totalCarbs: number;
  totalCalories?: number;
}

export interface FavoriteRecord {
  id: string;
  userId: string;
  targetType: 'food' | 'recipe';
  targetId: string;
  createdAt: string;
}

export interface AppSettings {
  id: string; // `settings_${userId}` or legacy `'app_settings'`
  userId: string;
  userName: string;
  diabetesLabel: string;
  darkMode: boolean;
  preferredUnit: 'g' | 'caseira';
  language: 'pt-BR';
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  lastBackupAt?: string;
  updatedAt: string;
}

export interface BackupMetadata {
  id: string;
  userId: string;
  exportedAt: string;
  itemCount: number;
  encrypted: boolean;
  note?: string;
}

export interface CalculationBreakdown {
  quantity: number;
  unitKey: MeasureUnitKey;
  unitLabel: string;
  gramsPerUnit: number | null;
  totalGrams: number | null;
  totalCarbs: number | null;
  availableCarbs: number | null;
  totalCalories: number | null;
  carbsPerSingleUnit: number | null;
  caloriesPerSingleUnit: number | null;
  conversionAvailable: boolean;
  conversionError?: string;
}

export type AppPage =
  | 'dashboard'
  | 'calculator'
  | 'diary'
  | 'database'
  | 'reports'
  | 'recipes'
  | 'settings';
