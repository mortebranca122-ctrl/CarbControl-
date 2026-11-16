import React, {useMemo, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  PieChart,
  Printer,
  Share2,
} from 'lucide-react';
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
import {Button, Card, Input} from '../../components/ui/primitives';
import {db} from '../../database/schema';
import {summarizeDailyMeals} from '../../services/calculator';
import {
  buildCarbControlPdf,
  downloadPdfReport,
  printPdfReport,
  sharePdfReport,
  type ReportDayData,
} from '../../services/pdf';
import type {UserProfile} from '../../types';
import {
  enumerateDateRange,
  formatDatePtBr,
  formatLongDatePtBr,
  getDateRangeForPeriod,
  getTodayIsoDate,
  getWeekdayShortPtBr,
  shiftIsoDate,
} from '../../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
  round1,
} from '../../utils/format';

interface HistoryReportsPageProps {
  activeUser: UserProfile;
  onBack: () => void;
}

type PeriodMode = 'diario' | 'semanal' | 'mensal' | 'personalizado';

export const HistoryReportsPage: React.FC<HistoryReportsPageProps> = ({
  activeUser,
  onBack,
}) => {
  const userId = activeUser.id;
  const [periodMode, setPeriodMode] = useState<PeriodMode>('diario');
  const [anchorDate, setAnchorDate] = useState(getTodayIsoDate());
  const [customStart, setCustomStart] = useState(shiftIsoDate(getTodayIsoDate(), -6));
  const [customEnd, setCustomEnd] = useState(getTodayIsoDate());
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const dateInfo = useMemo(() => {
    if (periodMode === 'personalizado') {
      const dates = enumerateDateRange(customStart, customEnd);
      return {startDate: customStart, endDate: customEnd, dates};
    }
    return getDateRangeForPeriod(anchorDate, periodMode);
  }, [periodMode, anchorDate, customStart, customEnd]);

  const allMealItems = useLiveQuery(
    () =>
      db.meal_items
        .where('userId')
        .equals(userId)
        .filter((r) => r.date >= dateInfo.startDate && r.date <= dateInfo.endDate)
        .toArray(),
    [userId, dateInfo.startDate, dateInfo.endDate],
    []
  );

  const allMeals = useLiveQuery(
    () =>
      db.meals
        .where('userId')
        .equals(userId)
        .filter((r) => r.date >= dateInfo.startDate && r.date <= dateInfo.endDate)
        .toArray(),
    [userId, dateInfo.startDate, dateInfo.endDate],
    []
  );

  const allGlucose = useLiveQuery(
    () =>
      db.glucose_records
        .where('userId')
        .equals(userId)
        .filter((r) => r.date >= dateInfo.startDate && r.date <= dateInfo.endDate)
        .toArray(),
    [userId, dateInfo.startDate, dateInfo.endDate],
    []
  );

  const allInsulin = useLiveQuery(
    () =>
      db.insulin_records
        .where('userId')
        .equals(userId)
        .filter((r) => r.date >= dateInfo.startDate && r.date <= dateInfo.endDate)
        .toArray(),
    [userId, dateInfo.startDate, dateInfo.endDate],
    []
  );

  const totalCarbsPeriod = useMemo(
    () => round1(allMealItems.reduce((acc, it) => acc + it.totalCarbs, 0)),
    [allMealItems]
  );

  const avgGlucosePeriod = useMemo(() => {
    if (allGlucose.length === 0) return null;
    const sum = allGlucose.reduce((acc, g) => acc + g.valueMgDl, 0);
    return Math.round(sum / allGlucose.length);
  }, [allGlucose]);

  // Real chart points (never fabricated)
  const chartSeries = useMemo(() => {
    if (periodMode === 'diario') {
      return MEAL_TYPE_ORDER.map((mt) => {
        const mealItems = allMealItems.filter((it) => it.mealType === mt);
        const mealGlucose = allGlucose.filter((g) => g.mealType === mt);
        return {
          label: MEAL_TYPE_LABELS[mt].split(' ')[0],
          carboidratos:
            mealItems.length > 0
              ? round1(mealItems.reduce((acc, i) => acc + i.totalCarbs, 0))
              : null,
          glicemia:
            mealGlucose.length > 0
              ? Math.round(
                  mealGlucose.reduce((acc, g) => acc + g.valueMgDl, 0) /
                    mealGlucose.length
                )
              : null,
        };
      });
    }

    return dateInfo.dates.map((d) => {
      const dayItems = allMealItems.filter((it) => it.date === d);
      const dayGlucose = allGlucose.filter((g) => g.date === d);
      return {
        label:
          periodMode === 'semanal'
            ? getWeekdayShortPtBr(d)
            : activeUser.dateFormat === 'YYYY-MM-DD'
            ? d.slice(5)
            : formatDatePtBr(d, 'DD/MM/YYYY').slice(0, 5),
        carboidratos:
          dayItems.length > 0
            ? round1(dayItems.reduce((acc, i) => acc + i.totalCarbs, 0))
            : null,
        glicemia:
          dayGlucose.length > 0
            ? Math.round(
                dayGlucose.reduce((acc, g) => acc + g.valueMgDl, 0) /
                  dayGlucose.length
              )
            : null,
      };
    });
  }, [periodMode, dateInfo.dates, allMealItems, allGlucose, activeUser.dateFormat]);

  const hasChartData = chartSeries.some(
    (p) => p.carboidratos !== null || p.glicemia !== null
  );

  const reportDaysData: ReportDayData[] = useMemo(() => {
    // Include days that have at least one record (or the single selected day in daily mode)
    const datesToShow =
      periodMode === 'diario'
        ? [anchorDate]
        : dateInfo.dates.filter(
            (d) =>
              allMealItems.some((i) => i.date === d) ||
              allGlucose.some((g) => g.date === d) ||
              allInsulin.some((ins) => ins.date === d)
          );

    return datesToShow.map((d) => ({
      date: d,
      items: allMealItems.filter((i) => i.date === d),
      meals: allMeals.filter((m) => m.date === d),
      glucose: allGlucose.filter((g) => g.date === d).sort((a, b) => a.time.localeCompare(b.time)),
      insulin: allInsulin.filter((i) => i.date === d).sort((a, b) => a.time.localeCompare(b.time)),
    }));
  }, [periodMode, anchorDate, dateInfo.dates, allMealItems, allMeals, allGlucose, allInsulin]);

  const periodTitle =
    periodMode === 'diario'
      ? 'Relatório Diário'
      : periodMode === 'semanal'
      ? 'Relatório Semanal'
      : periodMode === 'mensal'
      ? 'Relatório Mensal'
      : 'Relatório Personalizado';

  const periodRangeLabel =
    dateInfo.startDate === dateInfo.endDate
      ? formatLongDatePtBr(dateInfo.startDate)
      : `${formatDatePtBr(dateInfo.startDate, activeUser.dateFormat)} a ${formatDatePtBr(dateInfo.endDate, activeUser.dateFormat)}`;

  const buildPdf = () =>
    buildCarbControlPdf({
      title: periodTitle,
      periodLabel: periodRangeLabel,
      userName: activeUser.displayName,
      days: reportDaysData,
    });

  const handleDownloadPdf = () => {
    const doc = buildPdf();
    downloadPdfReport(doc, `carbcontrol-relatorio-${dateInfo.startDate}.pdf`);
  };

  const handlePrintPdf = () => {
    const doc = buildPdf();
    printPdfReport(doc);
  };

  const handleSharePdf = async () => {
    try {
      const doc = buildPdf();
      const res = await sharePdfReport(
        doc,
        `carbcontrol-relatorio-${dateInfo.startDate}.pdf`,
        `${periodTitle} — CarbControl`
      );
      setShareFeedback(
        res === 'shared'
          ? 'Relatório compartilhado pelo dispositivo.'
          : 'Compartilhamento direto indisponível neste navegador; o PDF foi baixado.'
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setShareFeedback('Não foi possível compartilhar o relatório neste navegador.');
    }
  };

  return (
    <div className="space-y-5" data-testid="reports-page">
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
            Histórico e Relatórios
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handlePrintPdf}>
            <Printer className="w-4 h-4 text-[#FF243D]" />
            <span>Imprimir</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleSharePdf()}>
            <Share2 className="w-4 h-4 text-[#FF243D]" />
            <span>Compartilhar</span>
          </Button>
          <Button size="sm" onClick={handleDownloadPdf}>
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </div>

      {shareFeedback && (
        <p className="text-xs text-emerald-400">{shareFeedback}</p>
      )}

      {/* Segmented Period Tabs (matches Reference Image 1) */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl border border-[#650000]/50 bg-white dark:bg-[#151515]">
        {(
          [
            ['diario', 'Diário'],
            ['semanal', 'Semanal'],
            ['mensal', 'Mensal'],
            ['personalizado', 'Período'],
          ] as Array<[PeriodMode, string]>
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPeriodMode(mode)}
            className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              periodMode === mode
                ? 'bg-[#B00020] text-white'
                : 'text-zinc-600 dark:text-[#B5B5B5] hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date Navigator */}
      {periodMode === 'personalizado' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">Data inicial</label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 dark:text-[#B5B5B5] block mb-1">Data final</label>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
          {customStart > customEnd && (
            <p className="text-xs text-amber-400">
              A data inicial é posterior à data final. Ajuste o intervalo para exibir os registros.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-[#650000]/55 bg-white dark:bg-[#151515] px-3 py-2">
          <button
            type="button"
            onClick={() =>
              setAnchorDate(
                shiftIsoDate(
                  anchorDate,
                  periodMode === 'diario' ? -1 : periodMode === 'semanal' ? -7 : -30
                )
              )
            }
            aria-label="Período anterior"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#B00020]/20 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono-num font-semibold">
            <Calendar className="w-4 h-4 text-[#FF243D]" />
            <span>{periodRangeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setAnchorDate(
                shiftIsoDate(
                  anchorDate,
                  periodMode === 'diario' ? 1 : periodMode === 'semanal' ? 7 : 30
                )
              )
            }
            aria-label="Próximo período"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#B00020]/20 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2 Summary Metric Cards (matches Reference Image 1) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center gap-3.5 sukuna-card-interactive">
          <div className="h-11 w-11 rounded-full bg-[#B00020]/20 border border-[#FF243D]/40 flex items-center justify-center shrink-0">
            <PieChart className="w-5 h-5 text-[#FF243D]" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">Total de Carboidratos</p>
            <p className="text-xl sm:text-2xl font-extrabold font-mono-num">
              {formatCarbs(totalCarbsPeriod)}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5 sukuna-card-interactive">
          <div className="h-11 w-11 rounded-full bg-[#B00020]/20 border border-[#FF243D]/40 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-[#FF243D]" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-[#B5B5B5]">Média de Glicemia</p>
            <p className="text-xl sm:text-2xl font-extrabold font-mono-num">
              {avgGlucosePeriod !== null ? `${avgGlucosePeriod} mg/dL` : '--'}
            </p>
          </div>
        </Card>
      </div>

      {/* Period Chart */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Gráfico do Período</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF243D]" />
              Glicemia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
              Carboidratos
            </span>
          </div>
        </div>

        {hasChartData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{top: 8, right: 12, left: -12, bottom: 0}}>
                <CartesianGrid stroke="rgba(176, 0, 32, 0.16)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9A9A9A" tick={{fill: '#B5B5B5', fontSize: 11}} />
                <YAxis stroke="#9A9A9A" tick={{fill: '#B5B5B5', fontSize: 11}} />
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
                  dot={{r: 4, fill: '#FF243D'}}
                  activeDot={{r: 6, fill: '#FF243D', stroke: '#FFFFFF', strokeWidth: 2}}
                  animationDuration={650}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="carboidratos"
                  name="Carboidratos (g)"
                  stroke="#A855F7"
                  strokeWidth={2.5}
                  dot={{r: 4, fill: '#A855F7'}}
                  activeDot={{r: 6, fill: '#A855F7', stroke: '#FFFFFF', strokeWidth: 2}}
                  animationDuration={650}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center rounded-xl border border-dashed border-[#650000]/50 text-xs text-zinc-400 px-4 text-center">
            Nenhum registro alimentar ou glicêmico encontrado neste período.
          </div>
        )}
      </Card>

      {/* Printable Report Sheet Preview (matches Reference Image 2 PDF Sheet!) */}
      <div className="rounded-2xl bg-white text-zinc-900 p-5 sm:p-6 shadow-xl border border-zinc-200 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#B00020] pb-3">
          <div className="flex items-center gap-2.5">
            <BloodDropEmblem size={30} />
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900">CarbControl</h3>
              <p className="text-xs text-zinc-500">
                Seu diário alimentar inteligente · {activeUser.displayName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#B00020]">{periodTitle}</p>
            <p className="text-xs text-zinc-600">{periodRangeLabel}</p>
          </div>
        </div>

        {reportDaysData.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">
            Sem registros para exibir na ficha neste intervalo.
          </p>
        ) : (
          reportDaysData.map((day) => {
            const daySum = summarizeDailyMeals(day.items);
            return (
              <div key={day.date} className="space-y-3 border-b border-zinc-200 pb-4 last:border-0">
                <div className="flex items-center justify-between text-xs font-bold text-[#B00020]">
                  <span>{formatDatePtBr(day.date, activeUser.dateFormat)}</span>
                  <span>Total do Dia: {formatCarbs(daySum.totalCarbs)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#9E0B22] text-white">
                        <th className="p-2 border border-zinc-300">Refeição</th>
                        <th className="p-2 border border-zinc-300">Alimentos</th>
                        <th className="p-2 border border-zinc-300">Quantidade</th>
                        <th className="p-2 border border-zinc-300 text-right">Carboidratos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEAL_TYPE_ORDER.map((mt) => {
                        const mItems = day.items.filter((i) => i.mealType === mt);
                        if (mItems.length === 0) {
                          return (
                            <tr key={mt} className="border-b border-zinc-200">
                              <td className="p-2 border border-zinc-200 font-semibold">
                                {MEAL_TYPE_LABELS[mt]}
                              </td>
                              <td className="p-2 border border-zinc-200 text-zinc-400 italic">
                                Sem registros
                              </td>
                              <td className="p-2 border border-zinc-200">—</td>
                              <td className="p-2 border border-zinc-200 text-right font-mono-num">
                                0,0 g
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <React.Fragment key={mt}>
                            {mItems.map((it, idx) => (
                              <tr key={it.id} className="border-b border-zinc-200">
                                <td className="p-2 border border-zinc-200 font-semibold">
                                  {idx === 0 ? MEAL_TYPE_LABELS[mt] : ''}
                                </td>
                                <td className="p-2 border border-zinc-200">
                                  {it.foodNameSnapshot}
                                </td>
                                <td className="p-2 border border-zinc-200">
                                  {formatDecimalPtBr(it.quantity, it.quantity % 1 === 0 ? 0 : 1)}{' '}
                                  {it.unitLabel} ({Math.round(it.totalGrams)} g)
                                </td>
                                <td className="p-2 border border-zinc-200 text-right font-mono-num">
                                  {formatCarbs(it.totalCarbs)}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <div>
                    <strong className="text-[#B00020]">Glicemia: </strong>
                    {day.glucose.length > 0
                      ? day.glucose.map((g) => `${g.time} (${g.valueMgDl} mg/dL)`).join(', ')
                      : '--'}
                  </div>
                  <div>
                    <strong className="text-[#B00020]">Insulina: </strong>
                    {day.insulin.length > 0
                      ? day.insulin
                          .map(
                            (i) =>
                              `${i.time} (${formatDecimalPtBr(i.units, i.units % 1 === 0 ? 0 : 1)} UI ${i.insulinType})`
                          )
                          .join(', ')
                      : '--'}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <Button className="w-full sm:w-auto" onClick={handleDownloadPdf}>
          <Download className="w-4 h-4" />
          <span>Baixar PDF Completo</span>
        </Button>
      </div>
    </div>
  );
};
