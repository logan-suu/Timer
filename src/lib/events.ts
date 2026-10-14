import { findConflicts as find, validateEvents as validate, occupiedRange as occupied, availableSlots as available } from '../../shared/domain.mjs';
import { validateSettings } from '../../shared/timezones.mjs';
import type { ConflictPair, PlannerSettings, ScheduleEvent } from '../types';
export { inferExamTiming } from '../../shared/domain.mjs';
export const findConflicts = (events: ScheduleEvent[]) => find(events) as ConflictPair[];
export const validateEvents = (events: unknown) => validate(events) as ScheduleEvent[];
export const occupiedRange = (event: ScheduleEvent) => occupied(event) as { start: string; end: string } | null;
export const availableSlots = (event: ScheduleEvent, events: ScheduleEvent[]) => available(event, events, new Date(Math.ceil(Date.now() / 60000) * 60000)) as { start: string; end: string; minutes: number }[];
export const displayStart = (event: ScheduleEvent) => event.plannedStart || event.start;
export function occupiedEvents(events: ScheduleEvent[]) {
  return events.flatMap(event => { const range = occupiedRange(event); return range ? [{ ...event, ...range }] : []; });
}
export function eventLabel(event: ScheduleEvent) {
  return event.company ? `${event.company} · ${event.title}` : event.title;
}
export function eventsBetween(events: ScheduleEvent[], start: Date, end: Date) {
  return events.filter(event => +new Date(event.start) < +end && +new Date(event.end) > +start);
}
export function parseBackup(text: string) {
  const value = JSON.parse(text);
  if (!value || value.version !== 1) throw new Error('不是有效的秋招日程备份，或版本暂不支持。');
  return { events: validateEvents(value.events), settings: value.settings ? validateSettings(value.settings) as PlannerSettings : undefined };
}
