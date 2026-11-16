import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {GlucoseRecord, InsulinRecord, Meal, MealItem} from '../types';
import {
  formatDatePtBr,
  formatLongDatePtBr,
} from '../utils/date';
import {
  formatCarbs,
  formatDecimalPtBr,
  GLUCOSE_CONTEXT_LABELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
} from '../utils/format';
import {summarizeDailyMeals} from './calculator';

export interface ReportDayData {
  date: string;
  items: MealItem[];
  meals: Meal[];
  glucose: GlucoseRecord[];
  insulin: InsulinRecord[];
  dayNotes?: string;
}

export interface PdfReportOptions {
  title: string;
  periodLabel: string;
  userName: string;
  days: ReportDayData[];
}

export function buildCarbControlPdf(options: PdfReportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const crimson: [number, number, number] = [176, 0, 32];
  const darkText: [number, number, number] = [24, 24, 27];
  const mutedText: [number, number, number] = [100, 100, 110];

  const drawHeader = (isFirstPage: boolean) => {
    // Crimson blood-drop emblem
    doc.setFillColor(...crimson);
    doc.circle(margin + 4.5, 17.5, 4.2, 'F');
    doc.triangle(margin + 4.5, 10, margin + 0.6, 16.3, margin + 8.4, 16.3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...darkText);
    doc.text('CarbControl', margin + 12, 16.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedText);
    doc.text(
      `Seu diário alimentar inteligente · Paciente: ${options.userName || 'Usuário'}`,
      margin + 12,
      21.5
    );

    // Right report title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...crimson);
    doc.text(options.title, pageWidth - margin, 15.5, {align: 'right'});

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkText);
    doc.text(options.periodLabel, pageWidth - margin, 21, {align: 'right'});

    // Subtle crimson divider
    doc.setDrawColor(...crimson);
    doc.setLineWidth(isFirstPage ? 0.6 : 0.35);
    doc.line(margin, 25, pageWidth - margin, 25);
  };

  drawHeader(true);

  let cursorY = 31;

  if (options.days.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...mutedText);
    doc.text('Nenhum registro encontrado no período selecionado.', margin, cursorY + 8);
  }

  for (let dIdx = 0; dIdx < options.days.length; dIdx++) {
    const day = options.days[dIdx];
    const summary = summarizeDailyMeals(day.items);

    if (dIdx > 0) {
      if (cursorY > pageHeight - 75) {
        doc.addPage();
        drawHeader(false);
        cursorY = 31;
      } else {
        cursorY += 6;
      }
    }

    // Day heading banner
    doc.setFillColor(248, 240, 242);
    doc.setDrawColor(215, 175, 182);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 8.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...crimson);
    doc.text(
      `${formatDatePtBr(day.date)} — ${formatLongDatePtBr(day.date)}`,
      margin + 3,
      cursorY + 5.7
    );

    doc.setTextColor(...darkText);
    doc.text(
      `Total do Dia: ${formatCarbs(summary.totalCarbs)}`,
      pageWidth - margin - 3,
      cursorY + 5.7,
      {align: 'right'}
    );

    cursorY += 11;

    // Build table rows matching the physical monitoring form
    const tableBody: Array<Array<string | {content: string; styles?: Record<string, unknown>}>> = [];

    for (const mealType of MEAL_TYPE_ORDER) {
      const mealItems = day.items.filter((i) => i.mealType === mealType);
      const mealLabel = MEAL_TYPE_LABELS[mealType];
      const mealTotal = summary.byMeal[mealType].totalCarbs;

      if (mealItems.length === 0) {
        tableBody.push([
          {content: mealLabel, styles: {fontStyle: 'bold'}},
          {content: 'Sem registros', styles: {textColor: [130, 130, 140], fontStyle: 'italic'}},
          '—',
          '0,0 g',
        ]);
      } else {
        mealItems.forEach((item, idx) => {
          const qtyFormatted = `${formatDecimalPtBr(item.quantity, item.quantity % 1 === 0 ? 0 : 1)} ${item.unitLabel}`;
          const weightSuffix =
            item.unitKey !== 'grama' ? ` (${Math.round(item.totalGrams)} g)` : '';
          tableBody.push([
            idx === 0 ? {content: mealLabel, styles: {fontStyle: 'bold'}} : '',
            `${item.foodNameSnapshot}${item.sourceSnapshot ? ` [${item.sourceSnapshot}]` : ''}`,
            `${qtyFormatted}${weightSuffix}`,
            formatCarbs(item.totalCarbs),
          ]);
        });
        tableBody.push([
          '',
          '',
          {content: 'Total da refeição:', styles: {fontStyle: 'bold', halign: 'right'}},
          {content: formatCarbs(mealTotal), styles: {fontStyle: 'bold', textColor: crimson}},
        ]);
      }
    }

    autoTable(doc, {
      startY: cursorY,
      margin: {left: margin, right: margin, top: 30, bottom: 18},
      head: [['Refeição', 'Alimentos', 'Quantidade', 'Carboidratos']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: darkText,
        lineColor: [220, 210, 214],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [158, 11, 34],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: {
        0: {cellWidth: 34},
        1: {cellWidth: 'auto'},
        2: {cellWidth: 44},
        3: {cellWidth: 26, halign: 'right'},
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(false);
        }
      },
    });

    const lastY = (doc as unknown as {lastAutoTable?: {finalY: number}}).lastAutoTable?.finalY ?? cursorY + 40;
    cursorY = lastY + 4;

    // Clinical log summary (Glucose, Insulin, Notes)
    if (cursorY > pageHeight - 42) {
      doc.addPage();
      drawHeader(false);
      cursorY = 31;
    }

    const glucoseRows =
      day.glucose.length > 0
        ? day.glucose
            .map(
              (g) =>
                `${g.time} · ${g.valueMgDl} mg/dL (${GLUCOSE_CONTEXT_LABELS[g.context]}${
                  g.mealType ? ` - ${MEAL_TYPE_LABELS[g.mealType]}` : ''
                })`
            )
            .join(' | ')
        : 'Nenhum registro de glicemia neste dia.';

    const insulinRows =
      day.insulin.length > 0
        ? day.insulin
            .map(
              (ins) =>
                `${ins.time} · ${formatDecimalPtBr(ins.units, ins.units % 1 === 0 ? 0 : 1)} UI (${ins.insulinType}${
                  ins.mealType ? ` - ${MEAL_TYPE_LABELS[ins.mealType]}` : ''
                })`
            )
            .join(' | ')
        : 'Nenhum registro de insulina neste dia.';

    const mealNotes = day.meals
      .filter((m) => m.notes?.trim())
      .map((m) => `${MEAL_TYPE_LABELS[m.mealType]}: ${m.notes?.trim()}`)
      .join(' | ');
    const notesText = [day.dayNotes, mealNotes].filter(Boolean).join(' · ') || '—';

    autoTable(doc, {
      startY: cursorY,
      margin: {left: margin, right: margin, top: 30, bottom: 18},
      body: [
        [{content: 'Glicemia', styles: {fontStyle: 'bold', cellWidth: 28}}, glucoseRows],
        [{content: 'Insulina', styles: {fontStyle: 'bold', cellWidth: 28}}, insulinRows],
        [{content: 'Observações', styles: {fontStyle: 'bold', cellWidth: 28}}, notesText],
      ],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.2,
        textColor: darkText,
        lineColor: [220, 210, 214],
        lineWidth: 0.2,
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(false);
        }
      },
    });

    const summaryEndY = (doc as unknown as {lastAutoTable?: {finalY: number}}).lastAutoTable?.finalY ?? cursorY + 22;
    cursorY = summaryEndY + 4;
  }

  // Page numbering & generation timestamp footer
  const totalPages = doc.getNumberOfPages();
  const generatedStamp = new Date().toLocaleString('pt-BR');
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(230, 220, 222);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text(
      `CarbControl — Sukuna Edition · Gerado localmente em ${generatedStamp} (somente registro pessoal, não substitui orientação médica)`,
      margin,
      pageHeight - 8.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8.5, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadPdfReport(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

export function printPdfReport(doc: jsPDF): void {
  const blobUrl = doc.output('bloburl');
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = String(blobUrl);
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(String(blobUrl));
      }, 60000);
    }, 250);
  };
}

export async function sharePdfReport(
  doc: jsPDF,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded'> {
  const blob = doc.output('blob');
  const file = new File([blob], filename, {type: 'application/pdf'});
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({files: [file]})
  ) {
    await navigator.share({
      title,
      text: 'Relatório gerado localmente no CarbControl — Sukuna Edition.',
      files: [file],
    });
    return 'shared';
  }
  doc.save(filename);
  return 'downloaded';
}
