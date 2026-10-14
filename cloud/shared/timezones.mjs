import { Temporal } from '@js-temporal/polyfill';

export const CHICAGO = 'America/Chicago';
export const BEIJING = 'Asia/Shanghai';
export const TIME_ZONES = [CHICAGO, BEIJING];
export const DEFAULT_SETTINGS = { displayTimeZone: CHICAGO, inputTimeZone: BEIJING };
export const zoneLabel = zone => zone === BEIJING ? '北京时间' : '芝加哥时间';
export const otherZone = zone => zone === CHICAGO ? BEIJING : CHICAGO;
export function validateSettings(value) {
  if (value == null) return { ...DEFAULT_SETTINGS };
  if (!TIME_ZONES.includes(value.displayTimeZone) || !TIME_ZONES.includes(value.inputTimeZone)) throw new Error('请选择芝加哥时间或北京时间。');
  return { displayTimeZone: value.displayTimeZone, inputTimeZone: value.inputTimeZone };
}
export function zoned(value, zone) {
  return Temporal.Instant.from(new Date(value).toISOString()).toZonedDateTimeISO(zone);
}
export function zonedDateKey(value, zone) { return zoned(value, zone).toPlainDate().toString(); }
export function zonedTimeLabel(value, zone) { return zoned(value, zone).toPlainTime().toString({ smallestUnit: 'minute' }); }
export function zonedInput(value, zone) { return zoned(value, zone).toPlainDateTime().toString({ smallestUnit: 'minute' }); }

/** Return zero instants for a skipped hour, two for a repeated hour. No implicit DST guessing. */
export function possibleInstants(value, zone) {
  if (!TIME_ZONES.includes(zone)) throw new Error('不支持这个时区。');
  const wall = Temporal.PlainDateTime.from(value, { overflow: 'reject' });
  const earlier = wall.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = wall.toZonedDateTime(zone, { disambiguation: 'later' });
  return [earlier, later].filter((candidate, index) => candidate.toPlainDateTime().equals(wall) &&
    (index === 0 || candidate.epochMilliseconds !== earlier.epochMilliseconds))
    .map(candidate => ({ iso: new Date(candidate.epochMilliseconds).toISOString(), offset: candidate.offset }));
}
export function fromZonedInput(value, zone, occurrence = '') {
  const instants = possibleInstants(value, zone);
  if (!instants.length) throw new Error('这个当地时间因夏令时切换而不存在，请选择其他时间。');
  if (instants.length > 1 && !['earlier', 'later'].includes(occurrence)) throw new Error('这个当地时间出现两次，请选择第一次或第二次。');
  return new Date(instants[occurrence === 'later' ? instants.length - 1 : 0].iso);
}
export function addCalendarDays(day, count) { return Temporal.PlainDate.from(day).add({ days: count }).toString(); }
export function addCalendarMonths(day, count) { return Temporal.PlainDate.from(day).with({ day: 1 }).add({ months: count }).toString(); }
export function calendarParts(day) {
  const value = Temporal.PlainDate.from(day);
  return { year: value.year, month: value.month, day: value.day, weekday: value.dayOfWeek - 1, daysInMonth: value.daysInMonth };
}
export function weekStart(day) { return addCalendarDays(day, -calendarParts(day).weekday); }
export function dayStart(day, zone) { return fromZonedInput(`${day}T00:00`, zone); }
export function offsetHoursApart(value) { return (zoned(value, BEIJING).offsetNanoseconds - zoned(value, CHICAGO).offsetNanoseconds) / 3600000000000; }
export function chicagoClockInfo(value) {
  const clock = zoned(value, CHICAGO);
  const daylight = clock.offset === '-05:00';
  return { offset: clock.offset, abbreviation: daylight ? 'CDT' : 'CST',
    label: daylight ? '夏令时' : '标准时间（冬令时）', differenceHours: offsetHoursApart(value) };
}
export function chicagoRangeInfo(start, end) {
  const first = chicagoClockInfo(start);
  const last = chicagoClockInfo(end);
  return { start: first, end: last, crossesTransition: first.offset !== last.offset,
    minutes: (+new Date(end) - +new Date(start)) / 60000 };
}

/** Name the clock next to its value, including DST when local times are ambiguous. */
export function rangeZoneLabel(start, end, zone) {
  if (zone === BEIJING) return zoneLabel(zone);
  const first = chicagoClockInfo(start);
  const last = chicagoClockInfo(end);
  const season = info => info.abbreviation === 'CDT' ? '夏令时' : '冬令时';
  if (first.offset !== last.offset) return `${zoneLabel(zone)}·${season(first)}→${season(last)}`;
  const repeated = [start, end].some(value => possibleInstants(zonedInput(value, zone), zone).length > 1);
  return `${zoneLabel(zone)}${repeated ? `·${season(first)}` : ''}`;
}
export function timeWithZone(value, zone) {
  return `${zonedTimeLabel(value, zone)}（${rangeZoneLabel(value, value, zone)}）`;
}

/** Absolute day boundaries correctly include 23-hour and 25-hour DST days. */
export function calendarSegments(events, day, zone) {
  const start = +dayStart(day, zone);
  const end = +dayStart(addCalendarDays(day, 1), zone);
  return events.filter(event => +new Date(event.start) < end && +new Date(event.end) > start).map(event => ({
    event, startMinute: (Math.max(start, +new Date(event.start)) - start) / 60000,
    endMinute: (Math.min(end, +new Date(event.end)) - start) / 60000,
  }));
}
