export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeHHmm(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function formatDatePtBr(
  isoDate: string,
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  if (dateFormat === 'YYYY-MM-DD') return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatLongDatePtBr(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getWeekdayShortPtBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return labels[dt.getDay()];
}

export function getDateRangeForPeriod(
  anchorDate: string,
  period: 'diario' | 'semanal' | 'mensal'
): {startDate: string; endDate: string; dates: string[]} {
  if (period === 'diario') {
    return {startDate: anchorDate, endDate: anchorDate, dates: [anchorDate]};
  }
  const count = period === 'semanal' ? 7 : 30;
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(shiftIsoDate(anchorDate, -i));
  }
  return {startDate: dates[0], endDate: dates[dates.length - 1], dates};
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates: string[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 366) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
    guard++;
  }
  return dates;
}

export function calculateAgeFromBirthDate(
  birthDateIso: string,
  referenceDateIso: string = getTodayIsoDate()
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) return null;
  const [by, bm, bd] = birthDateIso.split('-').map(Number);
  const [ry, rm, rd] = referenceDateIso.split('-').map(Number);
  if (by > ry || (by === ry && (bm > rm || (bm === rm && bd > rd)))) {
    return null;
  }
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : null;
}
