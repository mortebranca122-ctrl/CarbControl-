import React, {useMemo} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  Activity,
  BookOpen,
  Calculator,
  ChefHat,
  ChevronRight,
  Database,
  Droplet,
  FileDown,
  Plus,
  UtensilsCrossed,
} from 'lucide-react';
import {motion} from 'motion/react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {BloodDropEmblem} from '../../components/BrandMark';
import {Button, Card} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {summarizeDailyMeals} from '../../services/calculator';
import type {AppPage, MealType, UserProfile} from '../../types';
import {formatLongDatePtBr, getTodayIsoDate} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  round1,
} from '../../utils/format';

interface DashboardPageProps {
  activeUser: UserProfile;
  onNavigate: (
    page: AppPage,
    options?: {openPdf?: boolean; mealType?: MealType}
  ) => void;
  onOpenQuickGlucose: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  activeUser,
  onNavigate,
  onOpenQuickGlucose,
}) => {
  const today = getTodayIsoDate();

  const todayItems = useLiveQuery(
    () =>
      db.meal_items
        .where('[userId+date]')
        .equals([activeUser.id, today])
        .toArray(),
    [activeUser.id, today],
    []
  );

  const todayGlucose = useLiveQuery(
    () =>
      db.glucose_records
        .where('[userId+date]')
        .equals([activeUser.id, today])
        .sortBy('time'),
    [activeUser.id, today],
    []
  );

  const summary = useMemo(() => summarizeDailyMeals(todayItems), [todayItems]);
  const latestGlucose =
    todayGlucose.length > 0 ? todayGlucose[todayGlucose.length - 1] : null;

  // Build real time-of-day chart series strictly from existing records (never fabricate points)
  const chartData = useMemo(() => {
    const getBucket = (timeOrMeal: string, isMeal = false): 'Manhã' | 'Tarde' | 'Noite' => {
      if (isMeal) {
        if (timeOrMeal === 'cafe_manha' || timeOrMeal === 'lanche_manha') return 'Manhã';
        if (timeOrMeal === 'almoco' || timeOrMeal === 'lanche_tarde') return 'Tarde';
        return 'Noite';
      }
      const hour = Number(timeOrMeal.split(':')[0] || 0);
      if (hour < 12) return 'Manhã';
      if (hour < 18) return 'Tarde';
      return 'Noite';
    };

    const buckets: Array<'Manhã' | 'Tarde' | 'Noite'> = ['Manhã', 'Tarde', 'Noite'];
    const points = buckets.map((period) => {
      const periodMeals = todayItems.filter(
        (it) => getBucket(it.mealType, true) === period
      );
      const periodGlucose = todayGlucose.filter(
        (g) => getBucket(g.time, false) === period
      );

      const carbs =
        periodMeals.length > 0
          ? round1(periodMeals.reduce((acc, it) => acc + it.totalCarbs, 0))
          : null;
      const glucose =
        periodGlucose.length > 0
          ? Math.round(
              periodGlucose.reduce((acc, g) => acc + g.valueMgDl, 0) /
                periodGlucose.length
            )
          : null;

      return {
        period,
        carboidratos: carbs,
        glicemia: glucose,
      };
    });

    const hasAnyPoint = points.some(
      (p) => p.carboidratos !== null || p.glicemia !== null
    );
    return {points, hasAnyPoint};
  }, [todayItems, todayGlucose]);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Desktop Top Hero Split + Mobile Header Greeting */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-8 space-y-5">
          {/* Greeting */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Olá, {activeUser.displayName}! 👋
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#FF243D] mt-0.5">
                Olá, {activeUser.displayName}! Bem-vindo ao CarbControl.
              </p>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-[#B5B5B5] mt-1">
                Aqui está seu resumo de hoje ·{' '}
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                  {formatLongDatePtBr(today)}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={onOpenQuickGlucose}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 text-[#FF243D]" />
              <span>Registrar Glicemia</span>
            </Button>
          </div>

          {/* 3 Main KPI Cards (Refeições | Carboidratos | Glicemia Atual) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.25, delay: 0.02, ease: [0.16, 1, 0.3, 1]}}
            >
              <Card className="sukuna-card-interactive h-full flex flex-col items-center justify-between text-center p-3 sm:p-5">
                <div className="flex flex-col items-center gap-1.5">
                  <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF243D]" />
                  <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-[#B5B5B5]">
                    Refeições
                  </span>
                </div>
                <div
                  className="text-2xl sm:text-4xl font-extrabold font-mono-num mt-2"
                  data-testid="kpi-meals-count"
                >
                  {summary.totalMealsWithItems}
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-[#8E8E93] mt-1">
                  registradas
                </span>
              </Card>
            </motion.div>

            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.25, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
            >
              <Card className="sukuna-card-interactive h-full flex flex-col items-center justify-between text-center p-3 sm:p-5">
                <div className="flex flex-col items-center gap-1.5">
                  <Droplet className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF243D]" />
                  <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-[#B5B5B5]">
                    Carboidratos
                  </span>
                </div>
                <div
                  className="text-xl sm:text-3xl font-extrabold font-mono-num mt-2 text-zinc-900 dark:text-white"
                  data-testid="kpi-carbs-total"
                >
                  {formatCarbs(summary.totalCarbs)}
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-[#8E8E93] mt-1">
                  do dia
                </span>
              </Card>
            </motion.div>

            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.25, delay: 0.14, ease: [0.16, 1, 0.3, 1]}}
            >
              <Card className="sukuna-card-interactive h-full flex flex-col items-center justify-between text-center p-3 sm:p-5">
                <div className="flex flex-col items-center gap-1.5">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF243D]" />
                  <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-[#B5B5B5]">
                    Glicemia Atual
                  </span>
                </div>
                <div
                  className="text-xl sm:text-3xl font-extrabold font-mono-num mt-2"
                  data-testid="kpi-glucose-latest"
                >
                  {latestGlucose ? (
                    <>
                      {latestGlucose.valueMgDl}{' '}
                      <span className="text-xs sm:text-sm font-semibold text-zinc-400">
                        mg/dL
                      </span>
                    </>
                  ) : (
                    '--'
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 dark:text-[#8E8E93] mt-1">
                  {latestGlucose ? `Última: ${latestGlucose.time}` : 'Sem registro'}
                </span>
              </Card>
            </motion.div>
          </div>

          {/* Progress Chart Card ("Seu progresso") */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base sm:text-lg font-bold">Seu progresso</h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-[#D4D4D8]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF243D]" />
                  Glicemia (mg/dL)
                </span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-[#D4D4D8]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
                  Carboidratos (g)
                </span>
              </div>
            </div>

            {chartData.hasAnyPoint ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.points}
                    margin={{top: 8, right: 12, left: -12, bottom: 0}}
                  >
                    <CartesianGrid stroke="rgba(176, 0, 32, 0.16)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      stroke="#9A9A9A"
                      tick={{fill: '#B5B5B5', fontSize: 12}}
                    />
                    <YAxis
                      stroke="#9A9A9A"
                      tick={{fill: '#B5B5B5', fontSize: 12}}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#151515',
                        borderColor: '#B00020',
                        borderRadius: '12px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="glicemia"
                      name="Glicemia (mg/dL)"
                      stroke="#FF243D"
                      strokeWidth={2.5}
                      dot={{r: 4, fill: '#FF243D', strokeWidth: 0}}
                      activeDot={{r: 6, fill: '#FF243D', stroke: '#FFFFFF', strokeWidth: 2}}
                      isAnimationActive
                      animationDuration={450}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="carboidratos"
                      name="Carboidratos (g)"
                      stroke="#A855F7"
                      strokeWidth={2.5}
                      dot={{r: 4, fill: '#A855F7', strokeWidth: 0}}
                      activeDot={{r: 6, fill: '#A855F7', stroke: '#FFFFFF', strokeWidth: 2}}
                      isAnimationActive
                      animationDuration={450}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#650000]/50 bg-rose-50/40 dark:bg-[#120C0E]/50 px-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhum registro alimentar ou de glicemia hoje ({formatDecimalPtBr(0, 0)} pontos).
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  O gráfico exibirá apenas valores realmente registrados por você.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => onNavigate('calculator')}>
                    Contar Carboidratos
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onOpenQuickGlucose}>
                    Registrar Glicemia
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Desktop Right Sukuna Hero Backdrop Card (matches Reference Image 2) */}
        <div className="hidden xl:flex xl:col-span-4 group relative overflow-hidden rounded-2xl border border-[#650000]/55 hover:border-[#FF243D]/65 bg-[#0D0D0D] min-h-[380px] flex-col justify-end p-6 transition-colors duration-300">
          <div className="sukuna-aura-breath pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-[#B00020]/30 blur-3xl" />
          <img
            src="./src/assets/images/sukuna_cursed_hero_1794849858421.jpg"
            alt="Ilustração temática Sukuna Edition"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-top opacity-70 group-hover:scale-[1.03] transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/45 to-transparent" />
          <div className="relative z-10 space-y-2 text-center">
            <blockquote className="text-base italic text-zinc-100 leading-relaxed">
              “Controle hoje, mais liberdade amanhã.”
            </blockquote>
            <p className="text-xs font-semibold tracking-wider text-[#FF243D]">
              — CarbControl
            </p>
          </div>
        </div>
      </div>

      {/* Ações Rápidas (matches Reference Image 1 & quick desktop shortcuts) */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BloodDropEmblem size={20} />
          <h2 className="text-base sm:text-lg font-bold">Ações rápidas</h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onNavigate('calculator')}
            className="sukuna-card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] p-3.5 sm:p-4 text-center cursor-pointer group"
          >
            <Calculator className="w-6 h-6 text-[#FF243D] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold leading-tight">
              Contador de Carboidratos
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="sukuna-card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] p-3.5 sm:p-4 text-center cursor-pointer group"
          >
            <BookOpen className="w-6 h-6 text-[#FF243D] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold leading-tight">Diário Alimentar</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('database')}
            className="sukuna-card-interactive flex flex-col items-center justify-center gap-2 rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] p-3.5 sm:p-4 text-center cursor-pointer group"
          >
            <Database className="w-6 h-6 text-[#FF243D] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold leading-tight">Banco de Alimentos</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('recipes')}
            className="sukuna-card-interactive hidden lg:flex flex-col items-center justify-center gap-2 rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] p-4 text-center cursor-pointer group"
          >
            <ChefHat className="w-6 h-6 text-[#FF243D] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold leading-tight">Receitas e Favoritos</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports', {openPdf: true})}
            className="sukuna-card-interactive hidden lg:flex flex-col items-center justify-center gap-2 rounded-xl border border-[#650000]/60 bg-rose-50 dark:bg-[#1A1013] p-4 text-center cursor-pointer group"
          >
            <FileDown className="w-6 h-6 text-[#FF243D] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold leading-tight">Exportar PDF</span>
          </button>
        </div>
      </Card>

      {/* Interactive Today's Meal Breakdown */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold">Refeições de hoje</h2>
          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF243D] hover:underline cursor-pointer"
          >
            <span>Abrir Diário</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {MEAL_TYPE_ORDER.map((mt) => {
            const mealSum = summary.byMeal[mt];
            const hasItems = mealSum.itemCount > 0;
            return (
              <button
                key={mt}
                type="button"
                onClick={() => onNavigate('diary', {mealType: mt})}
                className="sukuna-card-interactive flex flex-col items-start justify-between rounded-xl border border-[#650000]/45 bg-rose-50/60 dark:bg-[#151012] p-3 text-left cursor-pointer"
              >
                <span className="text-[11px] font-medium text-zinc-600 dark:text-[#B5B5B5] truncate w-full">
                  {MEAL_TYPE_LABELS[mt]}
                </span>
                <span
                  className={`mt-1.5 text-sm font-extrabold font-mono-num ${
                    hasItems ? 'text-[#FF243D]' : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {hasItems ? formatCarbs(mealSum.totalCarbs) : '0,0 g'}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-[#8E8E93] mt-0.5">
                  {hasItems
                    ? `${mealSum.itemCount} ${mealSum.itemCount === 1 ? 'item' : 'itens'}`
                    : 'Adicionar'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
