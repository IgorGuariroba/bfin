export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  if (!MONTH_KEY_REGEX.test(key)) {
    throw new Error(`Invalid month key: ${key}`);
  }
  const [yearStr, monthStr] = key.split("-");
  return { year: Number(yearStr), month: Number(monthStr) };
}

export function previousMonth(key: string): string {
  const { year, month } = parseMonthKey(key);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

export function nextMonth(key: string): string {
  const { year, month } = parseMonthKey(key);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthNum = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonthNum).padStart(2, "0")}`;
}

export function firstDayOfMonth(key: string): Date {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function lastDayOfMonth(keyOrDate: string | Date): Date {
  if (typeof keyOrDate === "string") {
    const { year, month } = parseMonthKey(keyOrDate);
    return new Date(Date.UTC(year, month, 0));
  }
  return new Date(
    Date.UTC(keyOrDate.getUTCFullYear(), keyOrDate.getUTCMonth() + 1, 0)
  );
}

export function daysInMonth(key: string): number {
  return lastDayOfMonth(key).getUTCDate();
}

export function daysInMonthRange(startKey: string, endKey: string): Date[] {
  const start = firstDayOfMonth(startKey);
  const end = lastDayOfMonth(endKey);
  const days: Date[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    days.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function monthKeyFromDate(date: Date): string {
  return monthKey(date);
}

export function minMonthKey(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxMonthKey(a: string, b: string): string {
  return a >= b ? a : b;
}

export function occurrenceDayInMonth(originalDay: number, monthKeyStr: string): Date {
  const { year, month } = parseMonthKey(monthKeyStr);
  const last = lastDayOfMonth(monthKeyStr).getUTCDate();
  const day = Math.min(originalDay, last);
  return new Date(Date.UTC(year, month - 1, day));
}
