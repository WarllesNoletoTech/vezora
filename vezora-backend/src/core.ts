import { DateTime } from 'luxon';

export type Schedule = Record<string, [string, string] | null>;
export const DEFAULT_SCHEDULE: Schedule = {
  '0': null, '1': ['09:00', '18:00'], '2': ['09:00', '18:00'],
  '3': ['09:00', '18:00'], '4': ['09:00', '18:00'],
  '5': ['09:00', '18:00'], '6': ['09:00', '13:00']
};
export function depositCents(priceCents: number, mode: string, value: number) {
  if (mode === 'PERCENT') return Math.min(priceCents, Math.round(priceCents * value / 100));
  if (mode === 'FIXED') return Math.min(priceCents, value);
  return 0;
}
export function localSlot(date: string, hhmm: string, zone: string) {
  const dt = DateTime.fromISO(`${date}T${hhmm}`, { zone });
  if (!dt.isValid || dt.toFormat('yyyy-MM-dd HH:mm') !== `${date} ${hhmm}`) throw new Error('Horário inválido');
  return dt.toUTC().toJSDate();
}
export function slotsForDay(args: {
  date: string; timezone: string; durationMin: number; schedule: Schedule;
  booked: Array<{startAt: Date; endAt: Date}>; now?: Date;
}) {
  const { date, timezone, durationMin, schedule, booked } = args;
  const day = DateTime.fromISO(date, { zone: timezone });
  if (!day.isValid || day.toFormat('yyyy-MM-dd') !== date) return [];
  const working = schedule[String(day.weekday % 7)];
  if (!working) return [];
  let cursor = DateTime.fromISO(`${date}T${working[0]}`, { zone: timezone });
  const close = DateTime.fromISO(`${date}T${working[1]}`, { zone: timezone });
  if (!cursor.isValid || !close.isValid || close <= cursor) return [];
  const now = DateTime.fromJSDate(args.now ?? new Date()).plus({ minutes: 5 });
  const results: string[] = [];
  for (; cursor.plus({minutes: durationMin}) <= close; cursor = cursor.plus({minutes: 30})) {
    const end = cursor.plus({minutes: durationMin});
    if (cursor <= now) continue;
    if (booked.some(b => b.startAt < end.toJSDate() && b.endAt > cursor.toJSDate())) continue;
    results.push(cursor.toFormat('HH:mm'));
  }
  return results;
}
export const phoneDigits = (s: string) => s.replace(/\D/g, '');
