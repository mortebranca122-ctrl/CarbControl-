import React, {useEffect, useMemo, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  FileDown,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Syringe,
  Trash2,
  Utensils,
} from 'lucide-react';
import {FoodThumbnail} from '../../components/FoodThumbnail';
import {Button, Card, Input, Modal, Select} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {summarizeDailyMeals} from '../../services/calculator';
import {
  calculateFoodPortion,
  getAvailableMeasuresForFood,
  searchFoods,
} from '../../services/nutrition';
import {buildCarbControlPdf, downloadPdfReport} from '../../services/pdf';
import {glucoseInputSchema, insulinInputSchema} from '../../services/validation';
import type {
  Food,
  GlucoseContext,
  MealItem,
  MealType,
  MeasureUnitKey,
  Recipe,
  UserProfile,
} from '../../types';
import {
  formatDatePtBr,
  formatLongDatePtBr,
  getCurrentTimeHHmm,
  getTodayIsoDate,
  shiftIsoDate,
} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  formatGrams,
  generateId,
  GLUCOSE_CONTEXT_LABELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
} from '../../utils/format';

interface FoodDiaryPageProps {
  activeUser: UserProfile;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  activeMealType: MealType;
  onChangeMealType: (mealType: MealType) => void;
  onOpenCalculatorForMeal: (mealType: MealType, date: string) => void;
}

const MEAL_ICONS: Record<MealType, React.ComponentType<{className?: string}>> = {
  cafe_manha: Coffee,
  lanche_manha: Cookie,
  almoco: Utensils,
  lanche_tarde: Sun,
  jantar: Utensils,
  ceia: Moon,
};

export const FoodDiaryPage: React.FC<FoodDiaryPageProps> = ({
  activeUser,
  selectedDate,
  onChangeDate,
  activeMealType,
  onChangeMealType,
  onOpenCalculatorForMeal,
}) => {
  const userId = activeUser.id;
  const items = useLiveQuery(
    () =>
      db.meal_items
        .where('[userId+date]')
        .equals([userId, selectedDate])
        .toArray(),
    [userId, selectedDate],
    []
  );
  const meals = useLiveQuery(
    () =>
      db.meals
        .where('[userId+date]')
        .equals([userId, selectedDate])
        .toArray(),
    [userId, selectedDate],
    []
  );
  const glucoseRecords = useLiveQuery(
    () =>
      db.glucose_records
        .where('[userId+date]')
        .equals([userId, selectedDate])
        .sortBy('time'),
    [userId, selectedDate],
    []
  );
  const insulinRecords = useLiveQuery(
    () =>
      db.insulin_records
        .where('[userId+date]')
        .equals([userId, selectedDate])
        .sortBy('time'),
    [userId, selectedDate],
    []
  );
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [], []);
  const allMeasures = useLiveQuery(() => db.food_measures.toArray(), [], []);
  const recipes = useLiveQuery(
    () => db.recipes.where('userId').equals(userId).sortBy('name'),
    [userId],
    []
  );

  const summary = useMemo(() => summarizeDailyMeals(items), [items]);
  const activeMealRecord = meals.find((m) => m.mealType === activeMealType);
  const activeMealItems = useMemo(
    () => items.filter((it) => it.mealType === activeMealType),
    [items, activeMealType]
  );

  // Add item modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTargetMeal, setAddTargetMeal] = useState<MealType>(activeMealType);
  const [addTab, setAddTab] = useState<'alimentos' | 'receitas'>('alimentos');
  const [foodQuery, setFoodQuery] = useState('');
  const [pickedFood, setPickedFood] = useState<Food | null>(null);
  const [pickedQty, setPickedQty] = useState('1');
  const [pickedUnit, setPickedUnit] = useState<MeasureUnitKey>('grama');
  const [addFoodError, setAddFoodError] = useState<string | null>(null);

  // Edit item modal
  const [editingItem, setEditingItem] = useState<MealItem | null>(null);
  const [editQty, setEditQty] = useState('1');
  const [editItemError, setEditItemError] = useState<string | null>(null);

  // Glucose modal
  const [glucoseModalOpen, setGlucoseModalOpen] = useState(false);
  const [gValue, setGValue] = useState('');
  const [gTime, setGTime] = useState(getCurrentTimeHHmm());
  const [gContext, setGContext] = useState<GlucoseContext>('antes_refeicao');
  const [gMeal, setGMeal] = useState<MealType>(activeMealType);
  const [gNotes, setGNotes] = useState('');
  const [gError, setGError] = useState<string | null>(null);

  // Insulin modal (pure logging only — no dose recommendations!)
  const [insulinModalOpen, setInsulinModalOpen] = useState(false);
  const [insType, setInsType] = useState('Ultrarrápida');
  const [insUnits, setInsUnits] = useState('');
  const [insTime, setInsTime] = useState(getCurrentTimeHHmm());
  const [insMeal, setInsMeal] = useState<MealType>(activeMealType);
  const [insNotes, setInsNotes] = useState('');
  const [insError, setInsError] = useState<string | null>(null);

  // Notes editing
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  useEffect(() => {
    setNotesDraft(null);
  }, [selectedDate, activeMealType, userId]);

  const filteredFoods = useMemo(() => searchFoods(foods, foodQuery), [foods, foodQuery]);

  const pickedFoodMeasures = useMemo(() => {
    if (!pickedFood) return [];
    return getAvailableMeasuresForFood(
      allMeasures.filter((m) => m.foodId === pickedFood.id)
    );
  }, [pickedFood, allMeasures]);

  const openAddForMeal = (mealType: MealType) => {
    setAddTargetMeal(mealType);
    onChangeMealType(mealType);
    setFoodQuery('');
    setAddTab('alimentos');
    setAddFoodError(null);
    setPickedFood(foods[0] ?? null);
    if (foods[0]) {
      const m = getAvailableMeasuresForFood(
        allMeasures.filter((x) => x.foodId === foods[0].id)
      );
      const def = m.find((x) => x.isDefault) || m[0];
      setPickedUnit(def?.unitKey || 'grama');
      setPickedQty(def?.unitKey === 'grama' ? '100' : '1');
    }
    setAddModalOpen(true);
  };

  const handleSaveFoodToMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFoodError(null);
    if (!pickedFood) return;
    const qty = Number(pickedQty.replace(',', '.'));
    const calc = calculateFoodPortion(pickedFood, pickedFoodMeasures, qty, pickedUnit);
    if (!calc.conversionAvailable) {
      setAddFoodError(calc.conversionError || 'Informe uma quantidade válida.');
      return;
    }

    const nowIso = new Date().toISOString();
    const dailyId = `${userId}_${selectedDate}`;
    const mealId = `${userId}_${selectedDate}_${addTargetMeal}`;

    await db.transaction('rw', db.daily_records, db.meals, db.meal_items, async () => {
      if (!(await db.daily_records.get(dailyId))) {
        await db.daily_records.put({
          id: dailyId,
          userId,
          date: selectedDate,
          updatedAt: nowIso,
        });
      }
      if (!(await db.meals.get(mealId))) {
        await db.meals.put({
          id: mealId,
          userId,
          date: selectedDate,
          mealType: addTargetMeal,
          updatedAt: nowIso,
        });
      }
      await db.meal_items.put({
        id: generateId('mi'),
        userId,
        mealId,
        date: selectedDate,
        mealType: addTargetMeal,
        foodId: pickedFood.id,
        foodNameSnapshot: pickedFood.name,
        preparationSnapshot: pickedFood.preparation,
        sourceSnapshot: pickedFood.sourceName,
        referenceCodeSnapshot: pickedFood.referenceCode,
        carbsPer100gSnapshot: pickedFood.carbsTotalPer100g,
        availableCarbsPer100gSnapshot: pickedFood.carbsAvailablePer100g,
        caloriesPer100gSnapshot: pickedFood.caloriesPer100g,
        quantity: calc.quantity,
        unitKey: calc.unitKey,
        unitLabel: calc.unitLabel,
        gramsPerUnitSnapshot: calc.gramsPerUnit!,
        totalGrams: calc.totalGrams!,
        totalCarbs: calc.totalCarbs!,
        availableCarbs: calc.availableCarbs ?? calc.totalCarbs!,
        totalCalories: calc.totalCalories ?? undefined,
        createdAt: nowIso,
      });
    });

    setAddModalOpen(false);
  };

  const handleAddRecipeToMeal = async (recipe: Recipe) => {
    const nowIso = new Date().toISOString();
    const dailyId = `${userId}_${selectedDate}`;
    const mealId = `${userId}_${selectedDate}_${addTargetMeal}`;
    const portionGrams = Math.round((recipe.totalWeightGrams / recipe.servings) * 100) / 100;
    const carbsPer100g =
      portionGrams > 0 ? Math.round(((recipe.carbsPerServing * 100) / portionGrams) * 100) / 100 : 0;

    await db.transaction('rw', db.daily_records, db.meals, db.meal_items, async () => {
      if (!(await db.daily_records.get(dailyId))) {
        await db.daily_records.put({
          id: dailyId,
          userId,
          date: selectedDate,
          updatedAt: nowIso,
        });
      }
      if (!(await db.meals.get(mealId))) {
        await db.meals.put({
          id: mealId,
          userId,
          date: selectedDate,
          mealType: addTargetMeal,
          updatedAt: nowIso,
        });
      }
      await db.meal_items.put({
        id: generateId('mi'),
        userId,
        mealId,
        date: selectedDate,
        mealType: addTargetMeal,
        recipeId: recipe.id,
        foodNameSnapshot: `${recipe.name} (Receita)`,
        preparationSnapshot: 'pronto',
        sourceSnapshot: 'Receita Pessoal',
        referenceCodeSnapshot: recipe.id.slice(0, 10),
        carbsPer100gSnapshot: carbsPer100g,
        availableCarbsPer100gSnapshot: carbsPer100g,
        caloriesPer100gSnapshot: recipe.caloriesPerServing
          ? Math.round(((recipe.caloriesPerServing * 100) / Math.max(1, portionGrams)) * 100) / 100
          : undefined,
        quantity: 1,
        unitKey: 'porcao',
        unitLabel: 'porção da receita',
        gramsPerUnitSnapshot: portionGrams,
        totalGrams: portionGrams,
        totalCarbs: recipe.carbsPerServing,
        availableCarbs: recipe.carbsPerServing,
        totalCalories: recipe.caloriesPerServing,
        createdAt: nowIso,
      });
    });

    setAddModalOpen(false);
  };

  const handleDeleteItem = async (id: string) => {
    await db.meal_items.delete(id);
  };

  const handleUpdateItemQty = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditItemError(null);
    if (!editingItem) return;
    const qty = Number(editQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setEditItemError('Informe uma quantidade válida maior que zero.');
      return;
    }
    const totalGrams = Math.round(qty * editingItem.gramsPerUnitSnapshot * 100) / 100;
    const totalCarbs =
      Math.round(((totalGrams * editingItem.carbsPer100gSnapshot) / 100) * 100) / 100;
    const availableCarbs =
      editingItem.availableCarbsPer100gSnapshot !== undefined
        ? Math.round(((totalGrams * editingItem.availableCarbsPer100gSnapshot) / 100) * 100) /
          100
        : totalCarbs;
    const totalCalories =
      editingItem.caloriesPer100gSnapshot !== undefined
        ? Math.round(((totalGrams * editingItem.caloriesPer100gSnapshot) / 100) * 100) /
          100
        : undefined;

    await db.meal_items.update(editingItem.id, {
      quantity: qty,
      totalGrams,
      totalCarbs,
      availableCarbs,
      totalCalories,
    });
    setEditingItem(null);
  };

  const handleSaveGlucose = async (e: React.FormEvent) => {
    e.preventDefault();
    setGError(null);
    const parsed = glucoseInputSchema.safeParse({
      date: selectedDate,
      time: gTime,
      valueMgDl: Number(gValue),
      context: gContext,
      mealType: gMeal,
      notes: gNotes.trim() || undefined,
    });
    if (!parsed.success) {
      setGError(parsed.error.issues[0]?.message || 'Dados inválidos.');
      return;
    }

    await db.glucose_records.put({
      id: generateId('glc'),
      userId,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    });
    setGValue('');
    setGNotes('');
    setGlucoseModalOpen(false);
  };

  const handleSaveInsulin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsError(null);
    const parsed = insulinInputSchema.safeParse({
      date: selectedDate,
      time: insTime,
      insulinType: insType,
      units: Number(insUnits.replace(',', '.')),
      mealType: insMeal,
      notes: insNotes.trim() || undefined,
    });
    if (!parsed.success) {
      setInsError(parsed.error.issues[0]?.message || 'Dados inválidos.');
      return;
    }

    await db.insulin_records.put({
      id: generateId('ins'),
      userId,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    });
    setInsUnits('');
    setInsNotes('');
    setInsulinModalOpen(false);
  };

  const handleSaveMealNotes = async (text: string) => {
    const mealId = `${userId}_${selectedDate}_${activeMealType}`;
    const nowIso = new Date().toISOString();
    await db.meals.put({
      id: mealId,
      userId,
      date: selectedDate,
      mealType: activeMealType,
      notes: text,
      updatedAt: nowIso,
    });
    setNotesDraft(null);
  };

  const handleExportDayPdf = () => {
    const doc = buildCarbControlPdf({
      title: 'Relatório Diário',
      periodLabel: formatLongDatePtBr(selectedDate),
      userName: activeUser.displayName,
      days: [
        {
          date: selectedDate,
          items,
          meals,
          glucose: glucoseRecords,
          insulin: insulinRecords,
        },
      ],
    });
    downloadPdfReport(doc, `carbcontrol-diario-${selectedDate}.pdf`);
  };

  // Meal-specific glucose & insulin summaries
  const mealGlucoseBefore = glucoseRecords.find(
    (g) => g.mealType === activeMealType && g.context === 'antes_refeicao'
  );
  const mealGlucoseAfter = glucoseRecords.find(
    (g) => g.mealType === activeMealType && g.context === 'apos_2h'
  );
  const mealInsulins = insulinRecords.filter((i) => i.mealType === activeMealType);

  return (
    <div className="space-y-5" data-testid="diary-page">
      {/* Header + Date Switcher + Export PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          Diário Alimentar
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#650000]/60 bg-white dark:bg-[#151515] px-2 py-1">
            <button
              type="button"
              onClick={() => onChangeDate(shiftIsoDate(selectedDate, -1))}
              aria-label="Dia anterior"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-[#B00020]/20 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <label className="relative flex items-center gap-2 px-2 cursor-pointer">
              <Calendar className="w-4 h-4 text-[#FF243D]" />
              <span className="text-xs sm:text-sm font-mono-num font-semibold">
                {formatDatePtBr(selectedDate, activeUser.dateFormat)}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && onChangeDate(e.target.value)}
                aria-label="Selecionar data do diário"
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={() => onChangeDate(shiftIsoDate(selectedDate, 1))}
              aria-label="Próximo dia"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-[#B00020]/20 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== getTodayIsoDate() && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChangeDate(getTodayIsoDate())}
            >
              Hoje
            </Button>
          )}

          <Button size="sm" onClick={handleExportDayPdf}>
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* Desktop 3-Column Layout (matching Reference Image 2) */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: 6 Meals Selector */}
        <Card className="lg:col-span-3 p-2.5 space-y-1.5">
          {MEAL_TYPE_ORDER.map((mt) => {
            const Icon = MEAL_ICONS[mt];
            const isActive = activeMealType === mt;
            const mealSum = summary.byMeal[mt];
            return (
              <button
                key={mt}
                type="button"
                onClick={() => {
                  onChangeMealType(mt);
                  setNotesDraft(null);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#B00020]/40 to-[#650000]/25 text-white border border-[#FF243D]/45'
                    : 'text-zinc-600 dark:text-[#B5B5B5] hover:bg-[#B00020]/10 hover:text-zinc-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 text-[#FF243D] shrink-0" />
                  <span className="truncate">{MEAL_TYPE_LABELS[mt]}</span>
                </span>
                <span className="text-xs font-mono-num text-[#FF243D] shrink-0">
                  {formatCarbs(mealSum.totalCarbs)}
                </span>
              </button>
            );
          })}
          <div className="border-t border-[#650000]/45 mt-2 pt-3 px-2 flex items-center justify-between text-sm font-bold">
            <span>Total do Dia</span>
            <span className="font-mono-num text-[#FF243D]" data-testid="diary-daily-total">
              {formatCarbs(summary.totalCarbs)}
            </span>
          </div>
        </Card>

        {/* Column 2: Active Meal Items */}
        <Card className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{MEAL_TYPE_LABELS[activeMealType]}</h2>
            <button
              type="button"
              onClick={() => onOpenCalculatorForMeal(activeMealType, selectedDate)}
              className="text-xs text-[#FF243D] hover:underline cursor-pointer"
            >
              Abrir no Contador
            </button>
          </div>

          {activeMealItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#650000]/50 p-6 text-center space-y-2">
              <p className="text-sm text-zinc-400">
                Nenhum alimento registrado em {MEAL_TYPE_LABELS[activeMealType]}.
              </p>
              <p className="text-xs text-zinc-500">
                Você pode adicionar alimentos ou deixar esta refeição vazia.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeMealItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#650000]/40 bg-rose-50/70 dark:bg-[#1A1013]/75 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.foodNameSnapshot}</p>
                    <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                      {formatDecimalPtBr(item.quantity, item.quantity % 1 === 0 ? 0 : 1)}{' '}
                      {item.unitLabel} · ≈ {formatGrams(item.totalGrams)} ·{' '}
                      {item.sourceSnapshot}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num text-sm font-bold text-[#FF243D]">
                      {formatCarbs(item.totalCarbs)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item);
                        setEditQty(String(item.quantity));
                        setEditItemError(null);
                      }}
                      aria-label={`Editar ${item.foodNameSnapshot}`}
                      className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-[#B00020]/20 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteItem(item.id)}
                      aria-label={`Excluir ${item.foodNameSnapshot}`}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full" onClick={() => openAddForMeal(activeMealType)}>
            <Plus className="w-4 h-4" />
            <span>Adicionar Alimento</span>
          </Button>

          <div className="border-t border-[#650000]/45 pt-3 flex items-center justify-between text-base font-bold">
            <span>Total da Refeição:</span>
            <span className="font-mono-num text-[#FF243D]">
              {formatCarbs(summary.byMeal[activeMealType].totalCarbs)}
            </span>
          </div>
        </Card>

        {/* Column 3: Glicemia, Insulina & Observações */}
        <div className="lg:col-span-4 space-y-4">
          {/* Glicemia */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#FF243D]" />
                <h3 className="text-sm font-bold">Glicemia</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGMeal(activeMealType);
                  setGTime(getCurrentTimeHHmm());
                  setGError(null);
                  setGlucoseModalOpen(true);
                }}
                aria-label="Registrar glicemia"
                className="p-1.5 rounded-lg hover:bg-[#B00020]/20 text-[#FF243D] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-[#B5B5B5]">Antes da refeição:</span>
                <span className="font-mono-num font-semibold">
                  {mealGlucoseBefore ? `${mealGlucoseBefore.valueMgDl} mg/dL` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-[#B5B5B5]">2h depois:</span>
                <span className="font-mono-num font-semibold">
                  {mealGlucoseAfter ? `${mealGlucoseAfter.valueMgDl} mg/dL` : '--'}
                </span>
              </div>
            </div>
            {glucoseRecords.length > 0 && (
              <div className="border-t border-[#650000]/30 pt-2 space-y-1 max-h-28 overflow-y-auto">
                {glucoseRecords.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">
                      {g.time} · {GLUCOSE_CONTEXT_LABELS[g.context]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-semibold">{g.valueMgDl} mg/dL</span>
                      <button
                        type="button"
                        onClick={() => void db.glucose_records.delete(g.id)}
                        aria-label="Excluir glicemia"
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Insulina (somente registro manual) */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Syringe className="w-4 h-4 text-[#FF243D]" />
                <h3 className="text-sm font-bold">Insulina (Registro)</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInsMeal(activeMealType);
                  setInsTime(getCurrentTimeHHmm());
                  setInsError(null);
                  setInsulinModalOpen(true);
                }}
                aria-label="Registrar insulina aplicada"
                className="p-1.5 rounded-lg hover:bg-[#B00020]/20 text-[#FF243D] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {mealInsulins.length === 0 && insulinRecords.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                Nenhuma aplicação registrada neste dia.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {insulinRecords.map((ins) => (
                  <div key={ins.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">
                      {ins.time} · {ins.insulinType}
                      {ins.mealType ? ` (${MEAL_TYPE_LABELS[ins.mealType]})` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-bold text-[#FF243D]">
                        {formatDecimalPtBr(ins.units, ins.units % 1 === 0 ? 0 : 1)} UI
                      </span>
                      <button
                        type="button"
                        onClick={() => void db.insulin_records.delete(ins.id)}
                        aria-label="Excluir registro de insulina"
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-zinc-500">
              Sistema exclusivamente para registro manual conforme prescrição médica.
            </p>
          </Card>

          {/* Observações */}
          <Card className="p-4 space-y-2">
            <h3 className="text-sm font-bold">Observações ({MEAL_TYPE_LABELS[activeMealType]})</h3>
            <textarea
              rows={2}
              value={notesDraft ?? activeMealRecord?.notes ?? ''}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={(e) => void handleSaveMealNotes(e.target.value)}
              placeholder="Adicione observações desta refeição..."
              className="w-full rounded-xl border border-[#650000]/60 bg-white dark:bg-[#151515] p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF243D]"
            />
          </Card>
        </div>
      </div>

      {/* Mobile Stacked 6-Meal View (matching Reference Image 1) */}
      <div className="lg:hidden space-y-3">
        {MEAL_TYPE_ORDER.map((mt) => {
          const Icon = MEAL_ICONS[mt];
          const mealItems = items.filter((it) => it.mealType === mt);
          const mealSum = summary.byMeal[mt];
          return (
            <Card key={mt} className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-[#FF243D]" />
                  <h2 className="text-sm font-bold">{MEAL_TYPE_LABELS[mt]}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openAddForMeal(mt)}
                  className="text-xs font-semibold text-[#FF243D] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>

              {mealItems.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum alimento registrado</p>
              ) : (
                <div className="space-y-1.5">
                  {mealItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-xs border-b border-[#650000]/20 pb-1.5 last:border-0 last:pb-0"
                    >
                      <span className="truncate">
                        {item.foodNameSnapshot} ({formatDecimalPtBr(item.quantity, item.quantity % 1 === 0 ? 0 : 1)}{' '}
                        {item.unitLabel})
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-zinc-400 font-mono-num">
                          {formatGrams(item.totalGrams)}
                        </span>
                        <span className="font-mono-num font-bold text-[#FF243D]">
                          {formatCarbs(item.totalCarbs)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteItem(item.id)}
                          aria-label={`Excluir ${item.foodNameSnapshot}`}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-1 border-t border-[#650000]/30 text-xs font-bold">
                <span>Total: {formatCarbs(mealSum.totalCarbs)}</span>
              </div>
            </Card>
          );
        })}

        {/* Mobile Glicemia & Insulina Quick Actions + Records List */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setGMeal(activeMealType);
              setGTime(getCurrentTimeHHmm());
              setGError(null);
              setGlucoseModalOpen(true);
            }}
          >
            <Activity className="w-4 h-4 text-[#FF243D]" />
            <span>+ Glicemia ({glucoseRecords.length})</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setInsMeal(activeMealType);
              setInsTime(getCurrentTimeHHmm());
              setInsError(null);
              setInsulinModalOpen(true);
            }}
          >
            <Syringe className="w-4 h-4 text-[#FF243D]" />
            <span>+ Insulina ({insulinRecords.length})</span>
          </Button>
        </div>

        {(glucoseRecords.length > 0 || insulinRecords.length > 0) && (
          <Card className="p-3.5 space-y-2.5">
            {glucoseRecords.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-[#FF243D]">Glicemias de hoje</p>
                {glucoseRecords.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 truncate">
                      {g.time} · {GLUCOSE_CONTEXT_LABELS[g.context]}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-num font-semibold">{g.valueMgDl} mg/dL</span>
                      <button
                        type="button"
                        onClick={() => void db.glucose_records.delete(g.id)}
                        aria-label="Excluir glicemia"
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {insulinRecords.length > 0 && (
              <div className="space-y-1 border-t border-[#650000]/25 pt-2 first:border-0 first:pt-0">
                <p className="text-[11px] font-bold text-[#FF243D]">Insulinas registradas</p>
                {insulinRecords.map((ins) => (
                  <div key={ins.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 truncate">
                      {ins.time} · {ins.insulinType}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-num font-bold text-[#FF243D]">
                        {formatDecimalPtBr(ins.units, ins.units % 1 === 0 ? 0 : 1)} UI
                      </span>
                      <button
                        type="button"
                        onClick={() => void db.insulin_records.delete(ins.id)}
                        aria-label="Excluir registro de insulina"
                        className="text-zinc-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Mobile Daily Total Bar */}
        <div className="sukuna-panel rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold">Total do Dia:</span>
          <span className="text-base font-extrabold font-mono-num text-[#FF243D]">
            {formatCarbs(summary.totalCarbs)}
          </span>
        </div>
      </div>

      {/* Add Food / Recipe to Meal Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={`Adicionar em ${MEAL_TYPE_LABELS[addTargetMeal]}`}
        subtitle={`Data: ${formatDatePtBr(selectedDate)}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0D0D0D] border border-[#650000]/40">
            <button
              type="button"
              onClick={() => setAddTab('alimentos')}
              className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                addTab === 'alimentos' ? 'bg-[#B00020] text-white' : 'text-zinc-400'
              }`}
            >
              Banco de Alimentos
            </button>
            <button
              type="button"
              onClick={() => setAddTab('receitas')}
              className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                addTab === 'receitas' ? 'bg-[#B00020] text-white' : 'text-zinc-400'
              }`}
            >
              Minhas Receitas
            </button>
          </div>

          {addTab === 'alimentos' ? (
            <form onSubmit={handleSaveFoodToMeal} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#FF243D] absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  placeholder="Filtrar alimento..."
                  className="pl-9"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 border border-[#650000]/40 rounded-xl p-1.5">
                {filteredFoods.slice(0, 20).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setPickedFood(f);
                      const m = getAvailableMeasuresForFood(
                        allMeasures.filter((x) => x.foodId === f.id)
                      );
                      const def = m.find((x) => x.isDefault) || m[0];
                      setPickedUnit(def?.unitKey || 'grama');
                      setPickedQty(def?.unitKey === 'grama' ? '100' : '1');
                    }}
                    className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-xs cursor-pointer ${
                      pickedFood?.id === f.id
                        ? 'bg-[#B00020]/30 border border-[#FF243D]/40 text-white'
                        : 'hover:bg-[#B00020]/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FoodThumbnail
                        name={f.name}
                        category={f.category}
                        imageUrl={f.imageUrl}
                        sizeClass="w-8 h-8"
                      />
                      <span className="truncate font-medium">{f.name}</span>
                    </div>
                    <span className="font-mono-num text-[#FF243D] shrink-0">
                      {formatDecimalPtBr(f.carbsTotalPer100g)} g/100g
                    </span>
                  </button>
                ))}
              </div>

              {pickedFood && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#B5B5B5] block mb-1">Quantidade</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={pickedQty}
                      onChange={(e) => setPickedQty(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#B5B5B5] block mb-1">Medida</label>
                    <Select
                      value={pickedUnit}
                      onChange={(e) => setPickedUnit(e.target.value as MeasureUnitKey)}
                    >
                      {pickedFoodMeasures.map((m) => (
                        <option key={m.id} value={m.unitKey}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {addFoodError && <p className="text-xs text-red-400">{addFoodError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!pickedFood}>
                  Salvar na Refeição
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recipes.length === 0 ? (
                <p className="text-xs text-zinc-400">Nenhuma receita cadastrada.</p>
              ) : (
                recipes.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#650000]/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{rec.name}</p>
                      <p className="text-xs text-[#FF243D] font-mono-num">
                        {formatCarbs(rec.carbsPerServing)} por porção
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void handleAddRecipeToMeal(rec)}>
                      Adicionar 1 Porção
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Item Quantity Modal */}
      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Editar Quantidade"
        subtitle={editingItem?.foodNameSnapshot}
      >
        <form onSubmit={handleUpdateItemQty} className="space-y-4">
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">
              Quantidade ({editingItem?.unitLabel})
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
            />
          </div>
          {editItemError && <p className="text-xs text-red-400">{editItemError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              Cancelar
            </Button>
            <Button type="submit">Atualizar</Button>
          </div>
        </form>
      </Modal>

      {/* Glucose Modal */}
      <Modal
        open={glucoseModalOpen}
        onClose={() => setGlucoseModalOpen(false)}
        title="Registrar Glicemia Capilar"
        subtitle={`Data: ${formatDatePtBr(selectedDate)}`}
      >
        <form onSubmit={handleSaveGlucose} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Valor (mg/dL) *</label>
              <Input
                type="number"
                value={gValue}
                onChange={(e) => setGValue(e.target.value)}
                placeholder="Ex: 112"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Horário *</label>
              <Input type="time" value={gTime} onChange={(e) => setGTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Contexto</label>
              <Select
                value={gContext}
                onChange={(e) => setGContext(e.target.value as GlucoseContext)}
              >
                {Object.entries(GLUCOSE_CONTEXT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Refeição relacionada</label>
              <Select
                value={gMeal}
                onChange={(e) => setGMeal(e.target.value as MealType)}
              >
                {MEAL_TYPE_ORDER.map((mt) => (
                  <option key={mt} value={mt}>
                    {MEAL_TYPE_LABELS[mt]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Observações</label>
            <Input
              value={gNotes}
              onChange={(e) => setGNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          {gError && <p className="text-xs text-red-400">{gError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGlucoseModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Glicemia</Button>
          </div>
        </form>
      </Modal>

      {/* Insulin Modal (pure logging only) */}
      <Modal
        open={insulinModalOpen}
        onClose={() => setInsulinModalOpen(false)}
        title="Registrar Insulina Aplicada"
        subtitle="Somente registro manual conforme orientação médica"
      >
        <form onSubmit={handleSaveInsulin} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Tipo de insulina *</label>
              <Select value={insType} onChange={(e) => setInsType(e.target.value)}>
                <option value="Ultrarrápida">Ultrarrápida</option>
                <option value="Regular">Regular</option>
                <option value="Basal / Lenta">Basal / Lenta</option>
                <option value="NPH">NPH</option>
                <option value="Outra">Outra</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Quantidade (UI) *</label>
              <Input
                type="number"
                step="0.5"
                value={insUnits}
                onChange={(e) => setInsUnits(e.target.value)}
                placeholder="Ex: 4"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Horário *</label>
              <Input type="time" value={insTime} onChange={(e) => setInsTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Refeição</label>
              <Select
                value={insMeal}
                onChange={(e) => setInsMeal(e.target.value as MealType)}
              >
                {MEAL_TYPE_ORDER.map((mt) => (
                  <option key={mt} value={mt}>
                    {MEAL_TYPE_LABELS[mt]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Observações</label>
            <Input
              value={insNotes}
              onChange={(e) => setInsNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          {insError && <p className="text-xs text-red-400">{insError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInsulinModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Registro</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
