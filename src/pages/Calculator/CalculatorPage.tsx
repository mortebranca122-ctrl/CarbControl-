import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Minus,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import {BarcodeScannerModal} from '../../components/BarcodeScannerModal';
import {BloodDropEmblem} from '../../components/BrandMark';
import {FoodThumbnail} from '../../components/FoodThumbnail';
import {Button, Card, Input, Select} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {summarizeMealItems} from '../../services/calculator';
import {
  calculateFoodPortion,
  getAvailableMeasuresForFood,
  searchFoods,
} from '../../services/nutrition';
import {
  assessFoodQuality,
  formatOptionalNutrient,
  getEquivalentFoods,
} from '../../services/nutritionEngine';
import type {
  Food,
  MealItem,
  MealType,
  MeasureUnitKey,
} from '../../types';
import {getTodayIsoDate} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  formatGrams,
  generateId,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  PREPARATION_LABELS,
  RELIABILITY_LABELS,
} from '../../utils/format';

interface CalculatorPageProps {
  userId: string;
  initialFoodId?: string;
  initialMealType?: MealType;
  initialDate?: string;
  onBack: () => void;
  onSavedToDiary: (date: string, mealType: MealType) => void;
}

interface StagedItem {
  tempId: string;
  food: Food;
  quantity: number;
  unitKey: MeasureUnitKey;
  unitLabel: string;
  gramsPerUnit: number;
  totalGrams: number;
  totalCarbs: number;
  availableCarbs: number;
  totalCalories?: number;
}

export const CalculatorPage: React.FC<CalculatorPageProps> = ({
  userId,
  initialFoodId,
  initialMealType = 'almoco',
  initialDate,
  onBack,
  onSavedToDiary,
}) => {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [], []);
  const allMeasures = useLiveQuery(() => db.food_measures.toArray(), [], []);

  const [query, setQuery] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState<string>(
    initialFoodId || 'food_arroz_branco_cozido'
  );
  const [quantityStr, setQuantityStr] = useState('4');
  const [unitKey, setUnitKey] = useState<MeasureUnitKey>('colher_sopa');
  const [targetDate, setTargetDate] = useState(initialDate || getTodayIsoDate());
  const [targetMeal, setTargetMeal] = useState<MealType>(initialMealType);
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialFoodId) setSelectedFoodId(initialFoodId);
  }, [initialFoodId]);

  useEffect(() => {
    if (initialDate) setTargetDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (initialMealType) setTargetMeal(initialMealType);
  }, [initialMealType]);

  const filteredFoods = useMemo(() => searchFoods(foods, query), [foods, query]);

  const selectedFood = useMemo(
    () =>
      foods.find((f) => f.id === selectedFoodId) ||
      filteredFoods[0] ||
      foods[0] ||
      null,
    [foods, filteredFoods, selectedFoodId]
  );

  const hasLoadedMeasures = allMeasures.length > 0;

  const foodMeasures = useMemo(() => {
    if (!selectedFood) return [];
    const docs = allMeasures.filter((m) => m.foodId === selectedFood.id);
    return getAvailableMeasuresForFood(docs);
  }, [allMeasures, selectedFood]);

  // Reset unit to default documented measure only after real IndexedDB measures load
  useEffect(() => {
    if (!selectedFood || !hasLoadedMeasures || foodMeasures.length === 0) return;
    const stillValid =
      unitKey === 'quilograma' || foodMeasures.some((m) => m.unitKey === unitKey);
    if (!stillValid) {
      const def = foodMeasures.find((m) => m.isDefault) || foodMeasures[0];
      setUnitKey(def.unitKey);
      setQuantityStr(
        selectedFood.id === 'food_arroz_branco_cozido' && def.unitKey === 'colher_sopa'
          ? '4'
          : def.unitKey === 'grama'
          ? '100'
          : '1'
      );
    }
  }, [selectedFood?.id, hasLoadedMeasures, foodMeasures]);

  const parsedQty = Number(quantityStr.replace(',', '.'));
  const calculation = useMemo(() => {
    if (!selectedFood) return null;
    return calculateFoodPortion(selectedFood, foodMeasures, parsedQty, unitKey);
  }, [selectedFood, foodMeasures, parsedQty, unitKey]);

  const stagedSummary = useMemo(() => summarizeMealItems(stagedItems), [stagedItems]);

  const handleSelectFood = (food: Food) => {
    setSelectedFoodId(food.id);
    const docs = allMeasures.filter((m) => m.foodId === food.id);
    const available = getAvailableMeasuresForFood(docs);
    const def = available.find((m) => m.isDefault) || available[0];
    if (def) {
      setUnitKey(def.unitKey);
      setQuantityStr(
        food.id === 'food_arroz_branco_cozido' && def.unitKey === 'colher_sopa'
          ? '4'
          : def.unitKey === 'grama'
          ? '100'
          : '1'
      );
    }
    setFeedback(null);
  };

  const adjustQuantity = (delta: number) => {
    const base = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
    const step = unitKey === 'grama' ? 10 : 1;
    const next = Math.max(unitKey === 'grama' ? 1 : 0.5, base + delta * step);
    setQuantityStr(String(Math.round(next * 100) / 100));
  };

  const buildStagedFromCurrent = (): StagedItem | null => {
    if (!selectedFood || !calculation || !calculation.conversionAvailable) return null;
    return {
      tempId: generateId('stg'),
      food: selectedFood,
      quantity: calculation.quantity,
      unitKey: calculation.unitKey,
      unitLabel: calculation.unitLabel,
      gramsPerUnit: calculation.gramsPerUnit!,
      totalGrams: calculation.totalGrams!,
      totalCarbs: calculation.totalCarbs!,
      availableCarbs: calculation.availableCarbs ?? calculation.totalCarbs!,
      totalCalories: calculation.totalCalories ?? undefined,
    };
  };

  const handleStageItem = () => {
    const item = buildStagedFromCurrent();
    if (!item) return;
    setStagedItems((prev) => [...prev, item]);
    setFeedback(`"${item.food.name}" adicionado à montagem da refeição.`);
  };

  const persistItemsToDiary = async (itemsToSave: StagedItem[]) => {
    if (itemsToSave.length === 0) return;
    const nowIso = new Date().toISOString();
    const dailyId = `${userId}_${targetDate}`;
    const mealId = `${userId}_${targetDate}_${targetMeal}`;

    const mealItems: MealItem[] = itemsToSave.map((item) => ({
      id: generateId('mi'),
      userId,
      mealId,
      date: targetDate,
      mealType: targetMeal,
      foodId: item.food.id,
      foodNameSnapshot: item.food.name,
      preparationSnapshot: item.food.preparation,
      sourceSnapshot: item.food.sourceName,
      referenceCodeSnapshot: item.food.referenceCode,
      carbsPer100gSnapshot: item.food.carbsTotalPer100g,
      availableCarbsPer100gSnapshot: item.food.carbsAvailablePer100g,
      caloriesPer100gSnapshot: item.food.caloriesPer100g,
      quantity: item.quantity,
      unitKey: item.unitKey,
      unitLabel: item.unitLabel,
      gramsPerUnitSnapshot: item.gramsPerUnit,
      totalGrams: item.totalGrams,
      totalCarbs: item.totalCarbs,
      availableCarbs: item.availableCarbs,
      totalCalories: item.totalCalories,
      createdAt: nowIso,
    }));

    await db.transaction('rw', db.daily_records, db.meals, db.meal_items, async () => {
      const existingDay = await db.daily_records.get(dailyId);
      if (!existingDay) {
        await db.daily_records.put({
          id: dailyId,
          userId,
          date: targetDate,
          updatedAt: nowIso,
        });
      }
      const existingMeal = await db.meals.get(mealId);
      if (!existingMeal) {
        await db.meals.put({
          id: mealId,
          userId,
          date: targetDate,
          mealType: targetMeal,
          updatedAt: nowIso,
        });
      }
      await db.meal_items.bulkPut(mealItems);
    });
  };

  const handleAddDirectlyToDiary = async () => {
    if (stagedItems.length > 0) {
      await persistItemsToDiary(stagedItems);
      setStagedItems([]);
      onSavedToDiary(targetDate, targetMeal);
      return;
    }
    const current = buildStagedFromCurrent();
    if (!current) return;
    await persistItemsToDiary([current]);
    onSavedToDiary(targetDate, targetMeal);
  };

  const defaultMeasureHint = foodMeasures.find((m) => m.unitKey !== 'grama') || foodMeasures[0];

  return (
    <div className="space-y-5" data-testid="calculator-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar ao início"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#650000]/50 hover:bg-[#B00020]/20 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <BloodDropEmblem size={24} />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Contador de Carboidratos
          </h1>
        </div>

        <Button variant="secondary" size="sm" onClick={() => setScannerOpen(true)}>
          <QrCode className="w-4 h-4 text-[#FF243D]" />
          <span>Código de Barras</span>
        </Button>
      </div>

      {/* Main 2-column Desktop Split matching Reference Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Search Input + Dropdown Matches */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#FF243D] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar alimento... (ex: arroz, banana, pão)"
              aria-label="Buscar alimento no contador"
              className="pl-10"
            />
          </div>

          {query.trim().length > 0 && (
            <Card className="p-2 max-h-56 overflow-y-auto divide-y divide-[#650000]/25">
              {filteredFoods.length === 0 ? (
                <p className="p-3 text-xs text-zinc-400">
                  Nenhum alimento encontrado para “{query}”. Cadastre manualmente no Banco de Alimentos ou via Código de Barras.
                </p>
              ) : (
                filteredFoods.slice(0, 12).map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => {
                      handleSelectFood(food);
                      setQuery('');
                    }}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#B00020]/15 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FoodThumbnail
                        name={food.name}
                        category={food.category}
                        imageUrl={food.imageUrl}
                        sizeClass="w-10 h-10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{food.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-[#B5B5B5] truncate">
                          {PREPARATION_LABELS[food.preparation]} · {food.sourceName}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono-num text-[#FF243D] font-semibold shrink-0">
                      {formatDecimalPtBr(food.carbsTotalPer100g)} g / 100 g
                    </span>
                  </button>
                ))
              )}
            </Card>
          )}

          {selectedFood && (
            <>
              {/* Selected Food Card (matches Reference 1 & 2) */}
              <Card className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <FoodThumbnail
                    name={selectedFood.name}
                    category={selectedFood.category}
                    imageUrl={selectedFood.imageUrl}
                    sizeClass="w-16 h-16"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold truncate">
                      {selectedFood.name}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                      {defaultMeasureHint && defaultMeasureHint.unitKey !== 'grama'
                        ? `${defaultMeasureHint.gramsPerUnit} g por ${defaultMeasureHint.label}`
                        : `${selectedFood.carbsTotalPer100g} g de carboidratos por 100 g`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#FF243D]">
                      <span>{selectedFood.sourceName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-400 font-normal">
                        {PREPARATION_LABELS[selectedFood.preparation]}
                      </span>
                    </div>
                  </div>
                </div>

                <Select
                  aria-label="Selecionar alimento rapidamente"
                  value={selectedFood.id}
                  onChange={(e) => {
                    const f = foods.find((item) => item.id === e.target.value);
                    if (f) handleSelectFood(f);
                  }}
                  className="hidden sm:block max-w-[210px] text-xs"
                >
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.sourceName})
                    </option>
                  ))}
                </Select>
              </Card>

              {/* Quantity & Measure Row */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-zinc-600 dark:text-[#D4D4D8]">
                    Quantidade:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(-1)}
                      aria-label="Diminuir quantidade"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] text-zinc-900 dark:text-white hover:border-[#FF243D] active:scale-95 transition-all cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={quantityStr}
                      onChange={(e) => setQuantityStr(e.target.value)}
                      aria-label="Valor da quantidade"
                      className="w-20 text-center font-mono-num font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuantity(1)}
                      aria-label="Aumentar quantidade"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] text-zinc-900 dark:text-white hover:border-[#FF243D] active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <Select
                      aria-label="Unidade de medida"
                      value={unitKey}
                      onChange={(e) => setUnitKey(e.target.value as MeasureUnitKey)}
                    >
                      {foodMeasures.map((m) => (
                        <option key={m.id} value={m.unitKey}>
                          {m.label}
                        </option>
                      ))}
                      {!foodMeasures.some((m) => m.unitKey === 'quilograma') && (
                        <option value="quilograma">quilogramas (kg)</option>
                      )}
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Result Box ("Resultado da Conta") */}
              {calculation && calculation.conversionAvailable ? (
                <motion.div
                  key={`${selectedFood.id}-${unitKey}-${calculation.totalCarbs}`}
                  initial={{opacity: 0.75, scale: 0.99}}
                  animate={{opacity: 1, scale: 1}}
                  transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
                  className="sukuna-panel rounded-2xl p-5 space-y-4"
                  data-testid="calculation-result"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-full border border-emerald-500/40 bg-emerald-500/15 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-[#B5B5B5]">
                        Resultado da Conta:
                      </p>
                      <p
                        className="text-3xl sm:text-4xl font-extrabold font-mono-num text-[#FF243D] leading-tight"
                        data-testid="calculated-carbs"
                      >
                        {formatDecimalPtBr(calculation.totalCarbs ?? 0, 2)} g
                      </p>
                      <p className="text-sm font-semibold">de carboidratos</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-[#650000]/45 pt-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Peso estimado: </span>
                      <strong className="font-mono-num" data-testid="calculated-weight">
                        {formatGrams(calculation.totalGrams ?? 0)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Energia: </span>
                      <strong className="font-mono-num">
                        {calculation.totalCalories !== null
                          ? `${Math.round(calculation.totalCalories)} kcal`
                          : 'Não informada'}
                      </strong>
                    </div>
                  </div>

                  <div className="border-t border-[#650000]/45 pt-3 space-y-1.5 text-xs">
                    <p className="font-semibold text-zinc-700 dark:text-zinc-200">
                      Detalhes por porção:
                    </p>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">
                        Carboidratos totais (1 {calculation.unitLabel}):
                      </span>
                      <span className="font-mono-num font-semibold">
                        {formatDecimalPtBr(calculation.carbsPerSingleUnit ?? 0, 2)} g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">
                        Carboidratos disponíveis (total):
                      </span>
                      <span className="font-mono-num font-semibold">
                        {calculation.availableCarbs !== null
                          ? `${formatDecimalPtBr(calculation.availableCarbs, 2)} g`
                          : 'Não informado'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Calorias (1 unid.):</span>
                      <span className="font-mono-num">
                        {calculation.caloriesPerSingleUnit !== null
                          ? `${Math.round(calculation.caloriesPerSingleUnit)} kcal`
                          : 'Não informado'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Fibras / Proteínas (100 g):</span>
                      <span className="font-mono-num">
                        {formatOptionalNutrient(selectedFood.fiberPer100g)} ·{' '}
                        {formatOptionalNutrient(selectedFood.proteinPer100g)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Confiabilidade:</span>
                      <span className="font-medium text-emerald-400">
                        {RELIABILITY_LABELS[selectedFood.reliability]} (
                        {assessFoodQuality(selectedFood).completenessPercent}% completo)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 dark:text-[#B5B5B5]">Fonte:</span>
                      <span className="font-medium text-[#FF243D]">
                        {selectedFood.sourceName} ({selectedFood.referenceCode})
                      </span>
                    </div>
                    {getEquivalentFoods(selectedFood, foods).length > 0 && (
                      <div className="pt-2 border-t border-[#650000]/30 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[#B5B5B5]">
                          Comparar em outra base:
                        </span>
                        {getEquivalentFoods(selectedFood, foods).map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => handleSelectFood(eq)}
                            className="rounded-lg border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] px-2 py-0.5 text-[11px] text-[#FF243D] hover:border-[#FF243D] transition-colors cursor-pointer"
                          >
                            {eq.sourceName} ({formatDecimalPtBr(eq.carbsTotalPer100g)} g)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <Card className="p-4 border-amber-500/40 flex items-start gap-3 text-sm text-amber-300">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Não foi possível calcular esta medida</p>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      {calculation?.conversionError || 'Informe uma quantidade válida.'}
                    </p>
                  </div>
                </Card>
              )}

              {/* Destination Meal + Multi-food Staging */}
              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                      Data do diário
                    </label>
                    <Input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      aria-label="Data para registrar refeição"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">
                      Refeição de destino
                    </label>
                    <Select
                      value={targetMeal}
                      onChange={(e) => setTargetMeal(e.target.value as MealType)}
                      aria-label="Refeição de destino"
                    >
                      {MEAL_TYPE_ORDER.map((mt) => (
                        <option key={mt} value={mt}>
                          {MEAL_TYPE_LABELS[mt]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {feedback && (
                  <p className="text-xs text-emerald-400 font-medium">{feedback}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!calculation?.conversionAvailable}
                    onClick={handleStageItem}
                  >
                    <Plus className="w-4 h-4 text-[#FF243D]" />
                    <span>Montar Refeição (Vários Itens)</span>
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!calculation?.conversionAvailable && stagedItems.length === 0}
                    onClick={() => void handleAddDirectlyToDiary()}
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {stagedItems.length > 0
                        ? `Salvar ${stagedItems.length} Itens na Refeição`
                        : 'Adicionar à Refeição'}
                    </span>
                  </Button>
                </div>
              </Card>

              {/* Staged multi-food items list */}
              {stagedItems.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">
                      Alimentos na montagem ({MEAL_TYPE_LABELS[targetMeal]})
                    </h3>
                    <span className="text-sm font-extrabold font-mono-num text-[#FF243D]">
                      Total: {formatCarbs(stagedSummary.totalCarbs)}
                    </span>
                  </div>
                  <div className="divide-y divide-[#650000]/30">
                    {stagedItems.map((item) => (
                      <div
                        key={item.tempId}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold">{item.food.name}</p>
                          <p className="text-zinc-500 dark:text-[#B5B5B5]">
                            {formatDecimalPtBr(item.quantity, item.quantity % 1 === 0 ? 0 : 1)}{' '}
                            {item.unitLabel} · {formatGrams(item.totalGrams)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num font-bold text-[#FF243D]">
                            {formatCarbs(item.totalCarbs)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setStagedItems((prev) =>
                                prev.filter((x) => x.tempId !== item.tempId)
                              )
                            }
                            aria-label={`Remover ${item.food.name} da lista`}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right Dicas Panel (matches Reference Image 2) */}
        <Card className="lg:col-span-4 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">Dicas</h2>
          </div>

          <ul className="space-y-3 text-xs sm:text-sm text-zinc-600 dark:text-[#D4D4D8]">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Prefira medidas caseiras padronizadas ou balança de cozinha.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Sempre confira a porção real consumida e o estado de preparo (cru x cozido).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Em produtos industrializados, compare a tabela nutricional do rótulo físico.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Em caso de dúvida sobre sua meta ou tratamento, consulte seu médico ou nutricionista.</span>
            </li>
          </ul>

          <div className="pt-6 flex justify-center opacity-70">
            <BloodDropEmblem size={64} />
          </div>
        </Card>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onFoodFoundOrCreated={(food) => {
          setSelectedFoodId(food.id);
        }}
      />
    </div>
  );
};
