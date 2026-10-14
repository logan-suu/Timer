import { deviceTimeZone, addCalendarDays, addCalendarMonths, calendarParts, dayStart, fromZonedInput, weekStart, zonedDateKey, zonedInput, zonedTimeLabel, rangeZoneLabel } from '../../shared/timezones.mjs';
import type { TimeZone } from '../types';
export { BEIJING, CHICAGO, TIME_ZONES, DEFAULT_SETTINGS, zoneLabel, otherZone, possibleInstants, fromZonedInput, dayStart, offsetHoursApart, chicagoClockInfo, chicagoRangeInfo, calendarSegments, rangeZoneLabel, timeWithZone } from '../../shared/timezones.mjs';
export { isValidTimeZone, canonicalTimeZone, deviceTimeZone, browserDefaultSettings, validateSettings, differenceLabel, zoneRangeInfo } from '../../shared/timezones.mjs';
const LOCAL_ZONE = deviceTimeZone();
export const addDays = (day: string, count: number) => addCalendarDays(day, count);
export const addMonths = (day: string, count: number) => addCalendarMonths(day, count);
export const dayParts = (day: string) => calendarParts(day);
export const startOfWeek = (day: string) => weekStart(day);
export function dateKey(value: Date | string, zone: TimeZone = LOCAL_ZONE): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : zonedDateKey(value, zone);
}
export const startOfDay = (value: Date | string, zone: TimeZone = LOCAL_ZONE) => dateKey(value, zone);
export const timeLabel = (value: Date | string, zone: TimeZone = LOCAL_ZONE) => zonedTimeLabel(value, zone);
export function dayLabel(value: Date | string, weekday = true, zone: TimeZone = LOCAL_ZONE) {
  const parts = dayParts(dateKey(value, zone));
  return `${parts.month}月${parts.day}日${weekday ? ` ${WEEKDAYS[parts.weekday]}` : ''}`;
}
export function rangeLabel(start: string, end: string, zone: TimeZone = LOCAL_ZONE) {
  return `${timeLabel(start, zone)} – ${dateKey(start, zone) !== dateKey(end, zone) ? `${dayLabel(end, false, zone)} ` : ''}${timeLabel(end, zone)}`;
}
export function rangeWithZone(start: string, end: string, zone: TimeZone = LOCAL_ZONE) {
  return `${rangeLabel(start, end, zone)}（${rangeZoneLabel(start, end, zone)}）`;
}
export const localInput = (value: Date | string, zone: TimeZone = LOCAL_ZONE) => zonedInput(value, zone);
export function atTime(day: string, hour: number, minute = 0, zone: TimeZone = LOCAL_ZONE) {
  if (hour === 24) return dayStart(addDays(day, 1), zone);
  return fromZonedInput(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, zone, 'earlier');
}
export function alternateTime(start: string, end: string, zone: TimeZone) {
  const parts = dayParts(dateKey(start, zone));
  return `${parts.month}/${parts.day} ${rangeWithZone(start, end, zone)}`;
}
export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours ? `${hours} 小时` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} 分钟` : ''}`;
}
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
