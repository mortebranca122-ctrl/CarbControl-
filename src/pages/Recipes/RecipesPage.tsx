import React, {useMemo, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  ArrowLeft,
  BookOpen,
  Heart,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {FoodThumbnail} from '../../components/FoodThumbnail';
import {Button, Card, Input, Modal, Select} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {calculateRecipeTotals} from '../../services/calculator';
import {calculateFoodPortion, getAvailableMeasuresForFood} from '../../services/nutrition';
import {recipeInputSchema} from '../../services/validation';
import type {MeasureUnitKey, MealType, Recipe, RecipeItem} from '../../types';
import {getTodayIsoDate} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  formatGrams,
  generateId,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
} from '../../utils/format';

interface RecipesPageProps {
  userId: string;
  onBack: () => void;
  onUsedInDiary: (date: string, mealType: MealType) => void;
}

export const RecipesPage: React.FC<RecipesPageProps> = ({userId, onBack, onUsedInDiary}) => {
  const recipes = useLiveQuery(
    () => db.recipes.where('userId').equals(userId).sortBy('name'),
    [userId],
    []
  );
  const recipeItems = useLiveQuery(
    () => db.recipe_items.where('userId').equals(userId).toArray(),
    [userId],
    []
  );
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [], []);
  const allMeasures = useLiveQuery(() => db.food_measures.toArray(), [], []);

  const [tab, setTab] = useState<'minhas' | 'favoritos'>('minhas');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Builder state
  const [rName, setRName] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rServings, setRServings] = useState('2');
  const [rIngredients, setRIngredients] = useState<RecipeItem[]>([]);
  const [rError, setRError] = useState<string | null>(null);

  // Add ingredient form inside builder
  const [ingFoodId, setIngFoodId] = useState('food_aveia_flocos');
  const [ingQty, setIngQty] = useState('2');
  const [ingUnit, setIngUnit] = useState<MeasureUnitKey>('colher_sopa');

  // Reuse in diary modal
  const [reuseRecipe, setReuseRecipe] = useState<Recipe | null>(null);
  const [reuseDate, setReuseDate] = useState(getTodayIsoDate());
  const [reuseMeal, setReuseMeal] = useState<MealType>('cafe_manha');
  const [reuseServings, setReuseServings] = useState('1');
  const [reuseError, setReuseError] = useState<string | null>(null);

  const displayedRecipes = useMemo(
    () => (tab === 'favoritos' ? recipes.filter((r) => r.isFavorite) : recipes),
    [recipes, tab]
  );

  const selectedIngFood = useMemo(
    () => foods.find((f) => f.id === ingFoodId) || foods[0] || null,
    [foods, ingFoodId]
  );

  const selectedIngMeasures = useMemo(() => {
    if (!selectedIngFood) return [];
    return getAvailableMeasuresForFood(
      allMeasures.filter((m) => m.foodId === selectedIngFood.id)
    );
  }, [selectedIngFood, allMeasures]);

  const openNewBuilder = () => {
    setEditingRecipe(null);
    setRName('');
    setRDesc('');
    setRServings('2');
    setRIngredients([]);
    setRError(null);
    setBuilderOpen(true);
  };

  const openEditBuilder = (rec: Recipe) => {
    setEditingRecipe(rec);
    setRName(rec.name);
    setRDesc(rec.description || '');
    setRServings(String(rec.servings));
    setRIngredients(recipeItems.filter((ri) => ri.recipeId === rec.id));
    setRError(null);
    setBuilderOpen(true);
  };

  const handleAddIngredient = () => {
    if (!selectedIngFood) return;
    const qty = Number(ingQty.replace(',', '.'));
    const calc = calculateFoodPortion(
      selectedIngFood,
      selectedIngMeasures,
      qty,
      ingUnit
    );
    if (!calc.conversionAvailable) {
      setRError(calc.conversionError || 'Medida inválida.');
      return;
    }
    setRError(null);
    setRIngredients((prev) => [
      ...prev,
      {
        id: generateId('ri'),
        userId,
        recipeId: editingRecipe?.id || 'pending',
        foodId: selectedIngFood.id,
        foodNameSnapshot: selectedIngFood.name,
        sourceSnapshot: selectedIngFood.sourceName,
        referenceCodeSnapshot: selectedIngFood.referenceCode,
        carbsPer100gSnapshot: selectedIngFood.carbsTotalPer100g,
        caloriesPer100gSnapshot: selectedIngFood.caloriesPer100g,
        quantity: calc.quantity,
        unitKey: calc.unitKey,
        unitLabel: calc.unitLabel,
        gramsPerUnitSnapshot: calc.gramsPerUnit!,
        totalGrams: calc.totalGrams!,
        totalCarbs: calc.totalCarbs!,
        totalCalories: calc.totalCalories ?? undefined,
      },
    ]);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setRError(null);
    const parsed = recipeInputSchema.safeParse({
      name: rName,
      description: rDesc.trim() || undefined,
      servings: Number(rServings),
    });
    if (!parsed.success) {
      setRError(parsed.error.issues[0]?.message || 'Verifique os campos da receita.');
      return;
    }
    if (rIngredients.length === 0) {
      setRError('Adicione pelo menos 1 ingrediente para calcular os carboidratos.');
      return;
    }

    const totals = calculateRecipeTotals(rIngredients, parsed.data.servings);
    const nowIso = new Date().toISOString();
    const recipeId = editingRecipe?.id || generateId('rec');

    const recipeObj: Recipe = {
      id: recipeId,
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      servings: parsed.data.servings,
      imageUrl: editingRecipe?.imageUrl,
      isFavorite: editingRecipe?.isFavorite ?? false,
      totalWeightGrams: totals.totalWeightGrams,
      totalCarbs: totals.totalCarbs,
      carbsPerServing: totals.carbsPerServing,
      caloriesPerServing: totals.caloriesPerServing,
      createdAt: editingRecipe?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const itemsToPersist = rIngredients.map((item) => ({
      ...item,
      userId,
      recipeId,
    }));

    await db.transaction('rw', db.recipes, db.recipe_items, async () => {
      await db.recipes.put(recipeObj);
      await db.recipe_items.where('recipeId').equals(recipeId).delete();
      await db.recipe_items.bulkPut(itemsToPersist);
    });

    setBuilderOpen(false);
  };

  const handleToggleFavorite = async (rec: Recipe) => {
    await db.recipes.update(rec.id, {
      isFavorite: !rec.isFavorite,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteRecipe = async (rec: Recipe) => {
    await db.transaction('rw', db.recipes, db.recipe_items, async () => {
      await db.recipe_items.where('recipeId').equals(rec.id).delete();
      await db.recipes.delete(rec.id);
    });
  };

  const handleConfirmReuseInDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuseRecipe) return;
    setReuseError(null);
    const portionCount = Number(reuseServings.replace(',', '.'));
    if (!Number.isFinite(portionCount) || portionCount <= 0) {
      setReuseError('Informe uma quantidade de porções maior que zero.');
      return;
    }

    const nowIso = new Date().toISOString();
    const dailyId = `${userId}_${reuseDate}`;
    const mealId = `${userId}_${reuseDate}_${reuseMeal}`;
    const gramsPerPortion =
      Math.round((reuseRecipe.totalWeightGrams / reuseRecipe.servings) * 100) / 100;
    const totalGrams = Math.round(gramsPerPortion * portionCount * 100) / 100;
    const totalCarbs = Math.round(reuseRecipe.carbsPerServing * portionCount * 100) / 100;
    const carbsPer100g =
      gramsPerPortion > 0
        ? Math.round(((reuseRecipe.carbsPerServing * 100) / gramsPerPortion) * 100) / 100
        : 0;

    await db.transaction('rw', db.daily_records, db.meals, db.meal_items, async () => {
      if (!(await db.daily_records.get(dailyId))) {
        await db.daily_records.put({
          id: dailyId,
          userId,
          date: reuseDate,
          updatedAt: nowIso,
        });
      }
      if (!(await db.meals.get(mealId))) {
        await db.meals.put({
          id: mealId,
          userId,
          date: reuseDate,
          mealType: reuseMeal,
          updatedAt: nowIso,
        });
      }
      await db.meal_items.put({
        id: generateId('mi'),
        userId,
        mealId,
        date: reuseDate,
        mealType: reuseMeal,
        recipeId: reuseRecipe.id,
        foodNameSnapshot: `${reuseRecipe.name} (Receita)`,
        preparationSnapshot: 'pronto',
        sourceSnapshot: 'Receita Pessoal',
        referenceCodeSnapshot: reuseRecipe.id.slice(0, 10),
        carbsPer100gSnapshot: carbsPer100g,
        availableCarbsPer100gSnapshot: carbsPer100g,
        quantity: portionCount,
        unitKey: 'porcao',
        unitLabel: 'porção(ões)',
        gramsPerUnitSnapshot: gramsPerPortion,
        totalGrams,
        totalCarbs,
        availableCarbs: totalCarbs,
        totalCalories: reuseRecipe.caloriesPerServing
          ? Math.round(reuseRecipe.caloriesPerServing * portionCount * 100) / 100
          : undefined,
        createdAt: nowIso,
      });
    });

    setReuseRecipe(null);
    onUsedInDiary(reuseDate, reuseMeal);
  };

  return (
    <div className="space-y-5" data-testid="recipes-page">
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
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Receitas e Favoritos
          </h1>
        </div>

        <Button onClick={openNewBuilder}>
          <Plus className="w-4 h-4" />
          <span>Nova Receita</span>
        </Button>
      </div>

      {/* Tabs: Minhas Receitas | Favoritos */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-[#650000]/50 bg-white dark:bg-[#151515] max-w-md">
        <button
          type="button"
          onClick={() => setTab('minhas')}
          className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
            tab === 'minhas' ? 'bg-[#B00020] text-white' : 'text-zinc-500 dark:text-[#B5B5B5]'
          }`}
        >
          Minhas Receitas ({recipes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('favoritos')}
          className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
            tab === 'favoritos' ? 'bg-[#B00020] text-white' : 'text-zinc-500 dark:text-[#B5B5B5]'
          }`}
        >
          Favoritos ({recipes.filter((r) => r.isFavorite).length})
        </button>
      </div>

      {displayedRecipes.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-sm text-zinc-400">
            {tab === 'favoritos'
              ? 'Você ainda não favoritou nenhuma receita.'
              : 'Nenhuma receita cadastrada.'}
          </p>
          <Button size="sm" onClick={openNewBuilder}>
            Criar Primeira Receita
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedRecipes.map((rec) => {
            const ings = recipeItems.filter((ri) => ri.recipeId === rec.id);
            return (
              <Card key={rec.id} className="p-4 flex flex-col justify-between gap-4 sukuna-card-interactive">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <FoodThumbnail
                      name={rec.name}
                      category="Pães e massas"
                      imageUrl={rec.imageUrl}
                      sizeClass="w-16 h-16"
                    />
                    <div className="min-w-0">
                      <h2 className="text-base font-bold truncate">{rec.name}</h2>
                      <p className="text-sm font-mono-num font-semibold text-[#FF243D]">
                        {formatCarbs(rec.carbsPerServing)} (por porção)
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
                        Rende {rec.servings} porção(ões) · Total: {formatCarbs(rec.totalCarbs)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleToggleFavorite(rec)}
                    aria-label={
                      rec.isFavorite ? `Remover ${rec.name} dos favoritos` : `Favoritar ${rec.name}`
                    }
                    className="p-2 rounded-xl hover:bg-[#B00020]/20 cursor-pointer shrink-0"
                  >
                    {rec.isFavorite ? (
                      <Star className="w-5 h-5 text-[#FF243D] fill-[#FF243D]" />
                    ) : (
                      <Heart className="w-5 h-5 text-[#B5B5B5]" />
                    )}
                  </button>
                </div>

                {ings.length > 0 && (
                  <div className="text-xs text-zinc-500 dark:text-[#B5B5B5] border-t border-[#650000]/30 pt-2.5 space-y-1">
                    {ings.map((ing) => (
                      <div key={ing.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {ing.foodNameSnapshot} ({ing.sourceSnapshot})
                        </span>
                        <span className="font-mono-num shrink-0">
                          {formatGrams(ing.totalGrams)} · {formatCarbs(ing.totalCarbs)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setReuseRecipe(rec);
                      setReuseServings('1');
                      setReuseError(null);
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Usar no Diário</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditBuilder(rec)}
                    aria-label={`Editar receita ${rec.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDeleteRecipe(rec)}
                    aria-label={`Excluir receita ${rec.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recipe Builder Modal */}
      <Modal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={editingRecipe ? 'Editar Receita' : 'Nova Receita'}
        subtitle="Calcule automaticamente os carboidratos por porção com base nos ingredientes"
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-[#B5B5B5] block mb-1">Nome da receita *</label>
              <Input
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder="Ex: Vitamina de Banana com Aveia"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Porções *</label>
              <Input
                type="number"
                min="1"
                value={rServings}
                onChange={(e) => setRServings(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Descrição</label>
            <Input
              value={rDesc}
              onChange={(e) => setRDesc(e.target.value)}
              placeholder="Modo de preparo ou observação"
            />
          </div>

          {/* Add Ingredient Row */}
          <div className="rounded-xl border border-[#650000]/45 bg-rose-50 dark:bg-[#1A1013] p-3 space-y-2.5">
            <p className="text-xs font-semibold text-[#FF243D]">Adicionar Ingrediente</p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <Select
                  value={ingFoodId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setIngFoodId(id);
                    const fMeasures = getAvailableMeasuresForFood(
                      allMeasures.filter((m) => m.foodId === id)
                    );
                    const def = fMeasures.find((m) => m.isDefault) || fMeasures[0];
                    if (def) setIngUnit(def.unitKey);
                  }}
                >
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.sourceName})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="number"
                  step="0.1"
                  value={ingQty}
                  onChange={(e) => setIngQty(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Select
                  value={ingUnit}
                  onChange={(e) => setIngUnit(e.target.value as MeasureUnitKey)}
                >
                  {selectedIngMeasures.map((m) => (
                    <option key={m.id} value={m.unitKey}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="button" className="w-full" onClick={handleAddIngredient}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Ingredients List */}
          {rIngredients.length > 0 && (
            <div className="rounded-xl border border-[#650000]/40 p-3 space-y-2">
              {rIngredients.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs border-b border-[#650000]/20 pb-1.5 last:border-0 last:pb-0"
                >
                  <div>
                    <span className="font-semibold">{item.foodNameSnapshot}</span>
                    <span className="text-[#B5B5B5]">
                      {' '}
                      · {formatDecimalPtBr(item.quantity, item.quantity % 1 === 0 ? 0 : 1)}{' '}
                      {item.unitLabel} ({formatGrams(item.totalGrams)}) · {item.sourceSnapshot}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num font-bold text-[#FF243D]">
                      {formatCarbs(item.totalCarbs)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRIngredients((prev) => prev.filter((x) => x.id !== item.id))
                      }
                      aria-label={`Remover ${item.foodNameSnapshot}`}
                      className="text-zinc-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {Number(rServings) >= 1 && (
                <div className="pt-2 border-t border-[#650000]/40 flex justify-between text-xs font-bold">
                  <span>Carboidratos por porção:</span>
                  <span className="text-[#FF243D] font-mono-num">
                    {formatCarbs(
                      calculateRecipeTotals(
                        rIngredients,
                        Math.max(1, Math.floor(Number(rServings) || 1))
                      ).carbsPerServing
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {rError && <p className="text-xs text-red-400">{rError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBuilderOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Receita</Button>
          </div>
        </form>
      </Modal>

      {/* Reuse Recipe in Diary Modal */}
      <Modal
        open={Boolean(reuseRecipe)}
        onClose={() => setReuseRecipe(null)}
        title="Adicionar Receita ao Diário"
        subtitle={reuseRecipe?.name}
      >
        <form onSubmit={handleConfirmReuseInDiary} className="space-y-3">
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Data</label>
            <Input
              type="date"
              value={reuseDate}
              onChange={(e) => setReuseDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Refeição</label>
              <Select
                value={reuseMeal}
                onChange={(e) => setReuseMeal(e.target.value as MealType)}
              >
                {MEAL_TYPE_ORDER.map((mt) => (
                  <option key={mt} value={mt}>
                    {MEAL_TYPE_LABELS[mt]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Porções</label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={reuseServings}
                onChange={(e) => setReuseServings(e.target.value)}
              />
            </div>
          </div>
          {reuseError && <p className="text-xs text-red-400">{reuseError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setReuseRecipe(null)}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar ao Diário</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
