import React, {useEffect, useRef, useState} from 'react';
import {BrowserMultiFormatReader, type IScannerControls} from '@zxing/browser';
import {Camera, CheckCircle2, Search, WifiOff} from 'lucide-react';
import {db} from '../database/schema';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import type {Food, FoodCategory, FoodMeasure} from '../types';
import {FOOD_CATEGORIES} from '../services/nutrition';
import {customFoodInputSchema} from '../services/validation';
import {generateId} from '../utils/format';
import {Button, Input, Modal, Select} from './ui/primitives';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onFoodFoundOrCreated: (food: Food) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  onClose,
  onFoodFoundOrCreated,
}) => {
  const isOnline = useOnlineStatus();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [foundFood, setFoundFood] = useState<Food | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Manual / label confirmation fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Outros');
  const [description, setDescription] = useState('');
  const [carbsPer100g, setCarbsPer100g] = useState('');
  const [caloriesPer100g, setCaloriesPer100g] = useState('');
  const [portionLabel, setPortionLabel] = useState('porção da embalagem (100 g)');
  const [portionGrams, setPortionGrams] = useState('100');
  const [sourceNote, setSourceNote] = useState('Rótulo do Fabricante');
  const [formError, setFormError] = useState<string | null>(null);

  const stopCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError(null);
      setStatusMessage(null);
      setFoundFood(null);
      setShowManualForm(false);
      setFormError(null);
      setLookingUp(false);
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não suportada neste navegador. Digite o código de barras abaixo.');
      return;
    }
    try {
      setCameraActive(true);
      const reader = new BrowserMultiFormatReader();
      if (!videoRef.current) return;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText().trim();
            setBarcodeInput(code);
            stopCamera();
            void lookupBarcode(code);
          }
        }
      );
      controlsRef.current = controls;
    } catch {
      setCameraActive(false);
      setCameraError(
        'Não foi possível acessar a câmera. Verifique as permissões ou digite o código manualmente.'
      );
    }
  };

  const lookupBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setLookingUp(true);
    setStatusMessage(null);
    setFoundFood(null);
    setShowManualForm(false);

    try {
      const localMatch = await db.foods.where('barcode').equals(code).first();
      if (localMatch) {
        setFoundFood(localMatch);
        setStatusMessage(`Produto encontrado na base local (${localMatch.sourceName}). Confira o rótulo físico antes de usar.`);
        return;
      }

      if (!isOnline) {
        setStatusMessage(
          'Você está offline e este código não está no banco local. Cadastre as informações do rótulo manualmente abaixo.'
        );
        setShowManualForm(true);
        return;
      }

      // Optional online lookup on Open Food Facts with strict user verification prompt
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
      );
      if (response.ok) {
        const json = await response.json();
        if (json?.status === 1 && json.product) {
          const p = json.product;
          const nutriments = p.nutriments || {};
          const carbs = Number(nutriments.carbohydrates_100g);
          const kcal = Number(nutriments['energy-kcal_100g']);
          setName(p.product_name_pt || p.product_name || '');
          setDescription(p.brands ? `Marca: ${p.brands}` : 'Produto industrializado');
          setCarbsPer100g(Number.isFinite(carbs) ? String(carbs) : '');
          setCaloriesPer100g(Number.isFinite(kcal) ? String(Math.round(kcal)) : '');
          setSourceNote('Rótulo do Fabricante (Open Food Facts — conferido)');
          setStatusMessage(
            'Dados externos encontrados. Confira obrigatoriamente com o rótulo físico da embalagem antes de salvar!'
          );
          setShowManualForm(true);
          return;
        }
      }

      setStatusMessage(
        'Produto não encontrado pelo código informado. Cadastre manualmente conforme o rótulo da embalagem.'
      );
      setShowManualForm(true);
    } catch {
      setStatusMessage(
        'Não foi possível consultar a base externa. Cadastre os dados do rótulo manualmente abaixo.'
      );
      setShowManualForm(true);
    } finally {
      setLookingUp(false);
    }
  };

  const handleSaveManualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const carbsNum = Number(carbsPer100g.replace(',', '.'));
    const kcalNum = caloriesPer100g.trim()
      ? Number(caloriesPer100g.replace(',', '.'))
      : undefined;
    const pGrams = Number(portionGrams.replace(',', '.'));

    const parsed = customFoodInputSchema.safeParse({
      name,
      category,
      description: description || 'Produto industrializado conferido no rótulo',
      preparation: 'industrializado',
      carbsTotalPer100g: carbsNum,
      carbsAvailablePer100g: carbsNum,
      caloriesPer100g: kcalNum,
      sourceName: sourceNote,
      referenceCode: barcodeInput.trim() ? `EAN-${barcodeInput.trim()}` : 'ROTULO-LOCAL',
      barcode: barcodeInput.trim() || undefined,
      measureLabel: portionLabel.trim() || undefined,
      measureGrams: Number.isFinite(pGrams) && pGrams > 0 ? pGrams : undefined,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Verifique os campos informados.');
      return;
    }

    const nowIso = new Date().toISOString();
    const newFood: Food = {
      id: generateId('food_ean'),
      name: parsed.data.name,
      altNames: [],
      category: parsed.data.category,
      description: parsed.data.description,
      preparation: 'industrializado',
      carbsTotalPer100g: parsed.data.carbsTotalPer100g,
      carbsAvailablePer100g: parsed.data.carbsAvailablePer100g,
      caloriesPer100g: parsed.data.caloriesPer100g,
      sourceId: 'src_rotulo',
      sourceName: parsed.data.sourceName,
      referenceCode: parsed.data.referenceCode,
      sourceVersion: 'RDC 429',
      referenceDate: nowIso.slice(0, 10),
      countryOfOrigin: 'Brasil',
      acquisitionMethod: 'Rótulo conferido via leitor de código de barras',
      licenseStatus: 'Informação comercial de embalagem local',
      reliability: 'rotulo',
      barcode: parsed.data.barcode,
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
        label: parsed.data.measureLabel,
        gramsPerUnit: parsed.data.measureGrams,
        isDefault: true,
      });
    }

    await db.transaction('rw', db.foods, db.food_measures, async () => {
      await db.foods.put(newFood);
      await db.food_measures.bulkPut(measures);
    });

    onFoodFoundOrCreated(newFood);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leitor de Código de Barras"
      subtitle="Leia pela câmera ou digite o código EAN/GTIN do produto"
    >
      <div className="space-y-4">
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Modo offline: consulta apenas produtos já salvos no dispositivo. Novos códigos podem ser cadastrados pelo rótulo físico.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={cameraActive ? 'danger' : 'secondary'}
            onClick={cameraActive ? stopCamera : startCamera}
          >
            <Camera className="w-4 h-4" />
            <span>{cameraActive ? 'Parar Câmera' : 'Ler com a Câmera'}</span>
          </Button>
          <div className="flex flex-1 min-w-[200px] gap-2">
            <Input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Ex: 7896002300124"
              aria-label="Código de barras EAN"
            />
            <Button
              type="button"
              disabled={!barcodeInput.trim() || lookingUp}
              onClick={() => void lookupBarcode(barcodeInput)}
              aria-label="Buscar código de barras"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div
          className={
            cameraActive
              ? 'overflow-hidden rounded-xl border border-[#FF243D]/50 bg-black'
              : 'hidden'
          }
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full max-h-56 object-cover"
          />
        </div>

        {cameraError && (
          <p className="text-xs text-amber-400">{cameraError}</p>
        )}

        {statusMessage && (
          <div className="rounded-xl border border-[#650000]/45 bg-rose-50 dark:bg-[#1A1013] p-3 text-xs text-zinc-700 dark:text-[#E4E4E7]">
            {statusMessage}
          </div>
        )}

        {foundFood && (
          <div className="rounded-xl border border-[#FF243D]/40 bg-rose-50 dark:bg-[#1A1013] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-zinc-900 dark:text-white">{foundFood.name}</p>
                <p className="text-xs text-zinc-600 dark:text-[#B5B5B5]">{foundFood.description}</p>
                <p className="text-xs text-[#FF243D] mt-1 font-mono-num">
                  {foundFood.carbsTotalPer100g} g carboidratos / 100 g · Fonte: {foundFood.sourceName}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  onFoodFoundOrCreated(foundFood);
                  onClose();
                }}
              >
                Usar este Alimento
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setName(foundFood.name);
                  setCategory(foundFood.category);
                  setDescription(foundFood.description);
                  setCarbsPer100g(String(foundFood.carbsTotalPer100g));
                  setCaloriesPer100g(
                    foundFood.caloriesPer100g !== undefined ? String(foundFood.caloriesPer100g) : ''
                  );
                  setShowManualForm(true);
                }}
              >
                Corrigir Rótulo
              </Button>
            </div>
          </div>
        )}

        {showManualForm && (
          <form onSubmit={handleSaveManualProduct} className="space-y-3 border-t border-[#650000]/40 pt-3">
            <p className="text-xs font-semibold text-[#FF243D]">
              Conferir e Cadastrar pelo Rótulo Físico
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Nome do produto *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Biscoito Integral" />
              </div>
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Categoria *</label>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FoodCategory)}
                >
                  {FOOD_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Carboidratos por 100 g *</label>
                <Input
                  type="number"
                  step="0.1"
                  value={carbsPer100g}
                  onChange={(e) => setCarbsPer100g(e.target.value)}
                  placeholder="Ex: 62.5"
                />
              </div>
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Calorias por 100 g (kcal)</label>
                <Input
                  type="number"
                  step="1"
                  value={caloriesPer100g}
                  onChange={(e) => setCaloriesPer100g(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Medida da embalagem</label>
                <Input
                  value={portionLabel}
                  onChange={(e) => setPortionLabel(e.target.value)}
                  placeholder="Ex: pacote individual (30 g)"
                />
              </div>
              <div>
                <label className="text-xs text-[#B5B5B5] block mb-1">Peso da medida (g)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={portionGrams}
                  onChange={(e) => setPortionGrams(e.target.value)}
                  placeholder="Ex: 30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Fonte nutricional registrada</label>
              <Input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} />
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Produto no Banco Local</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
