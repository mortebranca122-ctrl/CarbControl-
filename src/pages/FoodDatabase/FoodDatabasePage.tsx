import React, {useMemo, useRef, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  AlertCircle,
  Calculator,
  Database,
  FileUp,
  Info,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {BarcodeScannerModal} from '../../components/BarcodeScannerModal';
import {FoodThumbnail} from '../../components/FoodThumbnail';
import {Button, Card, Input, Modal, Select} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {FOOD_CATEGORIES} from '../../services/nutrition';
import {
  assessFoodQuality,
  formatOptionalNutrient,
  getEquivalentFoods,
  importAuthorizedCatalogJson,
  unifiedFoodSearch,
} from '../../services/nutritionEngine';
import {customFoodInputSchema} from '../../services/validation';
import type {Food, FoodCategory, FoodMeasure, FoodPreparation} from '../../types';
import {getTodayIsoDate} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  generateId,
  PREPARATION_LABELS,
  RELIABILITY_LABELS,
} from '../../utils/format';

interface FoodDatabasePageProps {
  onUseFoodInCalculator: (foodId: string) => void;
}

export const FoodDatabasePage: React.FC<FoodDatabasePageProps> = ({
  onUseFoodInCalculator,
}) => {
  const catalogFileRef = useRef<HTMLInputElement | null>(null);
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [], []);
  const allMeasures = useLiveQuery(() => db.food_measures.toArray(), [], []);
  const foodSources = useLiveQuery(
    () => db.food_sources.orderBy('priority').toArray(),
    [],
    []
  );
  const importLogs = useLiveQuery(
    () => db.catalog_imports.orderBy('importedAt').reverse().limit(5).toArray(),
    [],
    []
  );

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'Todos'>('Todos');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('Todas');
  const [selectedPreparation, setSelectedPreparation] = useState<FoodPreparation | 'Todas'>(
    'Todas'
  );
  const [selectedFoodId, setSelectedFoodId] = useState<string>('food_arroz_branco_cozido');
  const [detailModalFood, setDetailModalFood] = useState<Food | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Import catalog modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Add custom food modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cCategory, setCCategory] = useState<FoodCategory>('Outros');
  const [cDesc, setCDesc] = useState('');
  const [cBrand, setCBrand] = useState('');
  const [cPrep, setCPrep] = useState<FoodPreparation>('cozido');
  const [cCarbs, setCCarbs] = useState('');
  const [cAvailCarbs, setCAvailCarbs] = useState('');
  const [cFiber, setCFiber] = useState('');
  const [cProtein, setCProtein] = useState('');
  const [cKcal, setCKcal] = useState('');
  const [cSource, setCSource] = useState('Cadastro Manual do Usuário');
  const [cRefCode, setCRefCode] = useState('MANUAL-01');
  const [cMeasureLabel, setCMeasureLabel] = useState('');
  const [cMeasureGrams, setCMeasureGrams] = useState('');
  const [cError, setCError] = useState<string | null>(null);

  const filteredFoods = useMemo(
    () =>
      unifiedFoodSearch(foods, {
        query,
        category: selectedCategory,
        sourceId: selectedSourceId,
        preparation: selectedPreparation,
      }),
    [foods, query, selectedCategory, selectedSourceId, selectedPreparation]
  );

  const activeFood = useMemo(
    () =>
      filteredFoods.find((f) => f.id === selectedFoodId) ||
      filteredFoods[0] ||
      foods.find((f) => f.id === selectedFoodId) ||
      null,
    [foods, filteredFoods, selectedFoodId]
  );

  const getMeasuresFor = (foodId: string) =>
    allMeasures.filter((m) => m.foodId === foodId);

  const handleCatalogFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importAuthorizedCatalogJson(text);
      setImportStatus({
        type: 'ok',
        text: `Catálogo importado com sucesso: ${res.importedCount} novos, ${res.updatedCount} atualizados, ${res.skippedDuplicates} já existentes.`,
      });
    } catch (err) {
      setImportStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao importar catálogo JSON.',
      });
    }
  };

  const handleCreateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    setCError(null);

    const carbsNum = Number(cCarbs.replace(',', '.'));
    const availNum = cAvailCarbs.trim()
      ? Number(cAvailCarbs.replace(',', '.'))
      : undefined;
    const fiberNum = cFiber.trim() ? Number(cFiber.replace(',', '.')) : undefined;
    const proteinNum = cProtein.trim() ? Number(cProtein.replace(',', '.')) : undefined;
    const kcalNum = cKcal.trim() ? Number(cKcal.replace(',', '.')) : undefined;
    const mGramsNum = cMeasureGrams.trim()
      ? Number(cMeasureGrams.replace(',', '.'))
      : undefined;

    const parsed = customFoodInputSchema.safeParse({
      name: cName,
      category: cCategory,
      description: cDesc,
      brand: cBrand.trim() || undefined,
      preparation: cPrep,
      carbsTotalPer100g: carbsNum,
      carbsAvailablePer100g: availNum,
      fiberPer100g: fiberNum,
      proteinPer100g: proteinNum,
      caloriesPer100g: kcalNum,
      sourceName: cSource,
      referenceCode: cRefCode,
      measureLabel: cMeasureLabel.trim() || undefined,
      measureGrams: mGramsNum,
    });

    if (!parsed.success) {
      setCError(parsed.error.issues[0]?.message || 'Verifique os campos.');
      return;
    }

    const nowIso = new Date().toISOString();
    const isLabel = parsed.data.sourceName.toLowerCase().includes('rótulo');
    const newFood: Food = {
      id: generateId('food_usr'),
      name: parsed.data.name,
      altNames: [],
      brand: parsed.data.brand,
      category: parsed.data.category,
      description: parsed.data.description,
      preparation: parsed.data.preparation,
      carbsTotalPer100g: parsed.data.carbsTotalPer100g,
      carbsAvailablePer100g: parsed.data.carbsAvailablePer100g,
      fiberPer100g: parsed.data.fiberPer100g,
      proteinPer100g: parsed.data.proteinPer100g,
      caloriesPer100g: parsed.data.caloriesPer100g,
      sourceId: isLabel ? 'src_rotulo' : 'src_manual',
      sourceName: parsed.data.sourceName,
      referenceCode: parsed.data.referenceCode,
      sourceVersion: 'Local',
      referenceDate: getTodayIsoDate(),
      countryOfOrigin: 'Brasil',
      acquisitionMethod: isLabel
        ? 'Informado via rótulo pelo usuário'
        : 'Informado manualmente pelo usuário',
      qualityNotes:
        'Registro pessoal cadastrado localmente — não equivale a análise laboratorial de tabela oficial.',
      licenseStatus: 'Dados locais do usuário',
      reliability: isLabel ? 'rotulo' : 'usuario',
      isUserCustom: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const measures: FoodMeasure[] = [
      {
        id: generateId('meas'),
        foodId: newFood.id,
        unitKey: 'grama',
        label: 'gramas (g)',
        gramsPerUnit: 1,
        isDefault: !parsed.data.measureGrams,
      },
    ];

    if (parsed.data.measureLabel && parsed.data.measureGrams) {
      measures.unshift({
        id: generateId('meas'),
        foodId: newFood.id,
        unitKey: 'porcao',
        label: `${parsed.data.measureLabel} (${parsed.data.measureGrams} g)`,
        gramsPerUnit: parsed.data.measureGrams,
        isDefault: true,
      });
    }

    await db.transaction('rw', db.foods, db.food_measures, async () => {
      await db.foods.put(newFood);
      await db.food_measures.bulkPut(measures);
    });

    setSelectedFoodId(newFood.id);
    setCName('');
    setCDesc('');
    setCBrand('');
    setCCarbs('');
    setCAvailCarbs('');
    setCFiber('');
    setCProtein('');
    setCKcal('');
    setCMeasureLabel('');
    setCMeasureGrams('');
    setCreateOpen(false);
  };

  const handleDeleteCustomFood = async (food: Food) => {
    if (!food.isUserCustom) return;
    await db.transaction('rw', db.foods, db.food_measures, async () => {
      await db.food_measures.where('foodId').equals(food.id).delete();
      await db.foods.delete(food.id);
    });
  };

  const renderFoodProvenanceDetails = (food: Food) => {
    const measures = getMeasuresFor(food.id);
    const primaryMeasure = measures.find((m) => m.unitKey !== 'grama') || measures[0];
    const quality = assessFoodQuality(food);
    const equivalents = getEquivalentFoods(food, foods);

    return (
      <div className="space-y-3.5 text-xs">
        <div className="flex items-center gap-3">
          <FoodThumbnail
            name={food.name}
            category={food.category}
            imageUrl={food.imageUrl}
            sizeClass="w-14 h-14"
          />
          <div className="min-w-0">
            <h3 className="font-bold text-base leading-snug">{food.name}</h3>
            {food.brand && (
              <p className="text-[11px] font-semibold text-[#FF243D]">{food.brand}</p>
            )}
            <p className="text-[11px] text-[#B5B5B5]">{food.description}</p>
            {food.scientificName && (
              <p className="text-[11px] italic text-zinc-400">{food.scientificName}</p>
            )}
          </div>
        </div>

        {/* Reliability & Completeness Badge */}
        <div className="rounded-xl border border-[#650000]/40 bg-rose-50 dark:bg-[#1A1013] p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              {RELIABILITY_LABELS[food.reliability]}
            </span>
            <span className="font-mono-num text-[11px] text-zinc-600 dark:text-[#B5B5B5]">
              Completude: {quality.completenessPercent}% ({quality.populatedFields}/
              {quality.totalTrackedFields})
            </span>
          </div>
          {quality.warning && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5 pt-0.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{quality.warning}</span>
            </p>
          )}
        </div>

        {/* Nutritional Facts per 100g */}
        <div className="space-y-1.5 border-t border-[#650000]/35 pt-2.5">
          <p className="font-bold text-[#FF243D] text-[11px] uppercase tracking-wider">
            Composição por 100 g / 100 ml
          </p>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Carboidratos totais:</span>
            <span className="font-mono-num font-bold text-[#FF243D]">
              {formatCarbs(food.carbsTotalPer100g)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Carbs disponíveis:</span>
            <span className="font-mono-num">
              {formatOptionalNutrient(food.carbsAvailablePer100g)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Fibras alimentares:</span>
            <span className="font-mono-num">{formatOptionalNutrient(food.fiberPer100g)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Açúcares:</span>
            <span className="font-mono-num">{formatOptionalNutrient(food.sugarPer100g)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Proteínas:</span>
            <span className="font-mono-num">{formatOptionalNutrient(food.proteinPer100g)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Gorduras totais:</span>
            <span className="font-mono-num">{formatOptionalNutrient(food.totalFatPer100g)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Gorduras saturadas:</span>
            <span className="font-mono-num">
              {formatOptionalNutrient(food.saturatedFatPer100g)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Energia:</span>
            <span className="font-mono-num">
              {formatOptionalNutrient(food.caloriesPer100g, 'kcal', 0)}
            </span>
          </div>
        </div>

        {/* Household measures */}
        <div className="space-y-1.5 border-t border-[#650000]/35 pt-2.5">
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Preparo:</span>
            <span className="font-medium">{PREPARATION_LABELS[food.preparation]}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500 dark:text-[#B5B5B5]">Medida padrão:</span>
            <span className="font-medium text-right">
              {primaryMeasure ? primaryMeasure.label : 'Somente peso em gramas'}
            </span>
          </div>
          {food.ingredientsText && (
            <div className="pt-1">
              <span className="text-zinc-500 dark:text-[#B5B5B5] block">Ingredientes:</span>
              <span className="text-[11px] text-zinc-300">{food.ingredientsText}</span>
            </div>
          )}
        </div>

        {/* Provenance (§26.4) */}
        <div className="space-y-1 border-t border-[#650000]/35 pt-2.5 text-[11px]">
          <p className="font-bold text-[#FF243D] uppercase tracking-wider flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Procedência e Licença
          </p>
          <div className="flex justify-between gap-2">
            <span className="text-[#B5B5B5]">Fonte:</span>
            <span className="font-semibold text-right">
              {food.sourceName} ({food.sourceVersion})
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#B5B5B5]">Código original:</span>
            <span className="font-mono-num">{food.referenceCode}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#B5B5B5]">Data ref. / País:</span>
            <span>
              {food.referenceDate} · {food.countryOfOrigin || 'Não informado'}
            </span>
          </div>
          <p className="text-[#B5B5B5] pt-0.5">
            <strong>Método:</strong> {food.acquisitionMethod}
          </p>
          <p className="text-[#B5B5B5]">
            <strong>Licença:</strong> {food.licenseStatus}
          </p>
        </div>

        {/* Equivalence comparison without erasing differences */}
        {equivalents.length > 0 && (
          <div className="border-t border-[#650000]/35 pt-2.5 space-y-1.5">
            <p className="text-[11px] font-bold text-[#FF243D]">
              Alimentos equivalentes em outras bases:
            </p>
            <div className="space-y-1">
              {equivalents.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => {
                    setSelectedFoodId(eq.id);
                    if (detailModalFood) setDetailModalFood(eq);
                  }}
                  className="w-full flex items-center justify-between rounded-lg border border-[#650000]/40 bg-rose-50 dark:bg-[#1A1013] px-2.5 py-1.5 text-[11px] hover:border-[#FF243D] transition-colors cursor-pointer text-left"
                >
                  <span className="truncate">
                    {eq.name} · <strong className="text-[#FF243D]">{eq.sourceName}</strong>
                  </span>
                  <span className="font-mono-num shrink-0">
                    {formatDecimalPtBr(eq.carbsTotalPer100g)} g
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5" data-testid="database-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Database className="w-6 h-6 text-[#FF243D]" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Banco de Alimentos
            </h1>
            <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">
              Catálogo multibase TBCA/USP · TACO/UNICAMP · USDA FDC · Rótulos ({foods.length}{' '}
              alimentos)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <FileUp className="w-4 h-4 text-[#FF243D]" />
            <span>Importar Catálogo</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setScannerOpen(true)}>
            <QrCode className="w-4 h-4 text-[#FF243D]" />
            <span>Código de Barras</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Novo Alimento</span>
          </Button>
        </div>
      </div>

      {/* Mobile Search & Category Strip (matches Reference Image 1) */}
      <div className="lg:hidden space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#FF243D] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar alimento, marca, ingrediente..."
            aria-label="Buscar alimento no banco"
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['Todos', ...FOOD_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#B00020] text-white'
                    : 'bg-white dark:bg-[#151515] border border-[#650000]/50 text-zinc-600 dark:text-[#B5B5B5]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop 3-Column Layout (matching Reference Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Category Sidebar (Desktop) */}
        <Card className="hidden lg:block lg:col-span-3 p-2.5 space-y-1 max-h-[75vh] overflow-y-auto">
          {(['Todos', ...FOOD_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#B00020]/40 to-[#650000]/25 text-white border border-[#FF243D]/45'
                    : 'text-zinc-600 dark:text-[#B5B5B5] hover:bg-[#B00020]/10 hover:text-zinc-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <span className="truncate">{cat}</span>
              </button>
            );
          })}
        </Card>

        {/* Center Search + Source/Prep Filters + Food Cards List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="hidden lg:block relative">
            <Search className="w-4 h-4 text-[#FF243D] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, nome popular, científico, marca ou ingrediente..."
              aria-label="Buscar alimento por nome"
              className="pl-10"
            />
          </div>

          {/* Multibase Source & Preparation Filters */}
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label="Filtrar por fonte nutricional"
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="text-xs min-h-[38px]"
            >
              <option value="Todas">Todas as fontes</option>
              {foodSources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.shortName} ({src.country})
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por preparo"
              value={selectedPreparation}
              onChange={(e) =>
                setSelectedPreparation(e.target.value as FoodPreparation | 'Todas')
              }
              className="text-xs min-h-[38px]"
            >
              <option value="Todas">Todos os preparos</option>
              {Object.entries(PREPARATION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {filteredFoods.length === 0 ? (
            <Card className="p-6 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                Nenhum alimento encontrado para os filtros atuais.
              </p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Cadastrar Alimento Manualmente
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              {filteredFoods.map((food) => {
                const isSelected = activeFood?.id === food.id;
                return (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => {
                      setSelectedFoodId(food.id);
                      if (window.innerWidth < 1024) {
                        setDetailModalFood(food);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-3 rounded-2xl p-3.5 text-left transition-all cursor-pointer border sukuna-card-interactive ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-[#1A1013] border-[#FF243D]/60 shadow-[0_0_20px_-10px_rgba(255,36,61,0.5)]'
                        : 'sukuna-card hover:border-[#FF243D]/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FoodThumbnail
                        name={food.name}
                        category={food.category}
                        imageUrl={food.imageUrl}
                        sizeClass="w-12 h-12"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{food.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-[#B5B5B5] font-mono-num">
                          {formatDecimalPtBr(food.carbsTotalPer100g)} g de carboidratos/100 g
                        </p>
                        <p className="text-[11px] font-semibold text-[#FF243D] mt-0.5 truncate">
                          {food.sourceName} · {PREPARATION_LABELS[food.preparation]}
                          {food.brand ? ` · ${food.brand}` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Info Detail Panel (Desktop, matches Reference Image 2) */}
        <Card className="hidden lg:block lg:col-span-4 p-5 space-y-4 sticky top-6 max-h-[82vh] overflow-y-auto">
          <h2 className="text-base font-bold border-b border-[#650000]/40 pb-2.5">
            Informações
          </h2>

          {activeFood ? (
            <div className="space-y-4">
              {renderFoodProvenanceDetails(activeFood)}

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  onClick={() => onUseFoodInCalculator(activeFood.id)}
                >
                  <Calculator className="w-4 h-4" />
                  <span>Calcular no Contador</span>
                </Button>
                {activeFood.isUserCustom && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-400"
                    onClick={() => void handleDeleteCustomFood(activeFood)}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir Alimento Cadastrado</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Selecione um alimento da lista.</p>
          )}
        </Card>
      </div>

      {/* Mobile Detail Modal */}
      <Modal
        open={Boolean(detailModalFood)}
        onClose={() => setDetailModalFood(null)}
        title={detailModalFood?.name || 'Detalhes do Alimento'}
        subtitle={detailModalFood?.description}
      >
        {detailModalFood && (
          <div className="space-y-4 text-sm">
            {renderFoodProvenanceDetails(detailModalFood)}

            <div className="space-y-1.5 border-t border-[#650000]/35 pt-2.5">
              <p className="text-xs font-semibold text-[#FF243D]">Medidas cadastradas:</p>
              {getMeasuresFor(detailModalFood.id).map((m) => (
                <div key={m.id} className="flex justify-between text-xs text-[#D4D4D8]">
                  <span>{m.label}</span>
                  <span className="font-mono-num">{m.gramsPerUnit} g</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  const id = detailModalFood.id;
                  setDetailModalFood(null);
                  onUseFoodInCalculator(id);
                }}
              >
                Calcular no Contador
              </Button>
              {detailModalFood.isUserCustom && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-400"
                  onClick={async () => {
                    await handleDeleteCustomFood(detailModalFood);
                    setDetailModalFood(null);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Alimento Cadastrado</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Import Catalog JSON Modal (§26.9) */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar / Atualizar Catálogo Nutricional"
        subtitle="Importe pacotes JSON offline de bases autorizadas (TBCA, TACO, USDA ou institucional)"
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#B5B5B5] leading-relaxed">
            O importador valida a estrutura, mantém o código e a versão da fonte original, evita
            duplicatas pela chave <code>sourceId + referenceCode</code> e registra o histórico local
            de atualização offline.
          </p>

          <input
            ref={catalogFileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleCatalogFileUpload}
            className="hidden"
          />

          <Button className="w-full" onClick={() => catalogFileRef.current?.click()}>
            <FileUp className="w-4 h-4" />
            <span>Selecionar Arquivo JSON do Catálogo</span>
          </Button>

          {importStatus && (
            <div
              className={`rounded-xl border p-3 ${
                importStatus.type === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-red-500/40 bg-red-950/30 text-red-300'
              }`}
            >
              {importStatus.text}
            </div>
          )}

          {importLogs.length > 0 && (
            <div className="space-y-1.5 border-t border-[#650000]/40 pt-3">
              <p className="font-bold text-[#FF243D]">Histórico de atualizações offline:</p>
              {importLogs.map((log) => (
                <div key={log.id} className="flex justify-between text-[11px] text-[#B5B5B5]">
                  <span>
                    {log.sourceName} ({log.version})
                  </span>
                  <span className="font-mono-num">
                    +{log.importedCount} / ~{log.updatedCount} ·{' '}
                    {new Date(log.importedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Custom Food Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cadastrar Novo Alimento"
        subtitle="Cadastros manuais são sinalizados como informados pelo usuário"
      >
        <form onSubmit={handleCreateCustomFood} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Nome do alimento *</label>
              <Input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Ex: Biscoito de arroz integral"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Marca (opcional)</label>
              <Input
                value={cBrand}
                onChange={(e) => setCBrand(e.target.value)}
                placeholder="Ex: Fabricante local"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Categoria *</label>
              <Select
                value={cCategory}
                onChange={(e) => setCCategory(e.target.value as FoodCategory)}
              >
                {FOOD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Estado de preparo *</label>
              <Select
                value={cPrep}
                onChange={(e) => setCPrep(e.target.value as FoodPreparation)}
              >
                {Object.entries(PREPARATION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B5B5B5] block mb-1">Descrição *</label>
            <Input
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              placeholder="Ex: Dados conforme rótulo da embalagem"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Carbs/100g *</label>
              <Input
                type="number"
                step="0.1"
                value={cCarbs}
                onChange={(e) => setCCarbs(e.target.value)}
                placeholder="76.0"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Disponíveis</label>
              <Input
                type="number"
                step="0.1"
                value={cAvailCarbs}
                onChange={(e) => setCAvailCarbs(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Fibras</label>
              <Input
                type="number"
                step="0.1"
                value={cFiber}
                onChange={(e) => setCFiber(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">kcal/100g</label>
              <Input
                type="number"
                step="1"
                value={cKcal}
                onChange={(e) => setCKcal(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Proteínas/100g</label>
              <Input
                type="number"
                step="0.1"
                value={cProtein}
                onChange={(e) => setCProtein(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Fonte *</label>
              <Input value={cSource} onChange={(e) => setCSource(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Código/Ref. *</label>
              <Input value={cRefCode} onChange={(e) => setCRefCode(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Medida caseira</label>
              <Input
                value={cMeasureLabel}
                onChange={(e) => setCMeasureLabel(e.target.value)}
                placeholder="Ex: unidade"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Peso (g)</label>
              <Input
                type="number"
                step="0.1"
                value={cMeasureGrams}
                onChange={(e) => setCMeasureGrams(e.target.value)}
                placeholder="Ex: 15"
              />
            </div>
          </div>
          {cError && <p className="text-xs text-red-400">{cError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Alimento</Button>
          </div>
        </form>
      </Modal>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onFoodFoundOrCreated={(food) => setSelectedFoodId(food.id)}
      />
    </div>
  );
};
