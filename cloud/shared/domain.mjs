import { TIME_ZONES } from './timezones.mjs';

export const EVENT_TYPES = ['exam', 'interview', 'prep', 'other'];
export const EVENT_COLORS = ['purple', 'blue', 'green', 'orange', 'pink', 'teal'];
export const MAX_EVENTS = 5000;

/** @typedef {{id:string,title:string,company:string,type:string,color:string,start:string,end:string,location:string,link:string,notes:string,timeZone?:string,timing?:string,durationMinutes?:number,plannedStart?:string}} ScheduleEvent */

/** Infer from elapsed time, so timezone changes and DST do not change the result.
 * @param {string | Date} start
 * @param {string | Date} end
 * @param {number} durationMinutes
 * @returns {'fixed' | 'window' | null}
 */
export function inferExamTiming(start, end, durationMinutes) {
  const span = +new Date(end) - +new Date(start);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440 || !Number.isFinite(span) || span < durationMinutes * 60000) return null;
  return span > durationMinutes * 60000 ? 'window' : 'fixed';
}

/** Validate before saving or importing. Never silently discard invalid records. */
export function validateEvents(input) {
  if (!Array.isArray(input) || input.length > MAX_EVENTS) throw new Error('日程格式不正确，最多支持 5000 条日程。');
  const ids = new Set();
  return input.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`第 ${index + 1} 条日程格式不正确。`);
    const required = ['id', 'title', 'type', 'color', 'start', 'end'];
    if (required.some(key => typeof value[key] !== 'string')) throw new Error(`第 ${index + 1} 条日程缺少必要信息。`);
    if (!value.id || value.id.length > 100 || ids.has(value.id)) throw new Error('日程编号为空或重复。');
    ids.add(value.id);
    if (!value.title.trim() || value.title.length > 120) throw new Error('日程名称需要填写，且不能超过 120 个字符。');
    if (!EVENT_TYPES.includes(value.type) || !EVENT_COLORS.includes(value.color)) throw new Error('日程类型或颜色不正确。');
    if (value.timeZone != null && !TIME_ZONES.includes(value.timeZone)) throw new Error('日程录入时区不正确。');
    const start = new Date(value.start);
    const end = new Date(value.end);
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.start) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.end)) throw new Error('备份中的日程时间必须包含时区或 UTC 偏移。');
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end <= +start || start.getUTCFullYear() < 2000 || end.getUTCFullYear() > 2100) {
      throw new Error('结束时间必须晚于开始时间，日期须在 2000 至 2100 年之间。');
    }
    if (+end - +start > 31 * 86400000) throw new Error('单条日程最长支持 31 天。');
    if (value.timing != null && !['fixed', 'window'].includes(value.timing)) throw new Error('笔试时间方式不正确。');
    let timingFields = {};
    let timing = value.timing;
    if (timing === 'window' || value.durationMinutes != null) {
      if (value.type !== 'exam') throw new Error('笔试时长和可选窗口仅用于笔试。');
      if (!Number.isInteger(value.durationMinutes) || value.durationMinutes < 1 || value.durationMinutes > 1440) throw new Error('笔试作答用时须为 1 至 1440 分钟。');
      timing = inferExamTiming(start, end, value.durationMinutes);
      if (!timing) throw new Error('时间段短于笔试时长，请调整开始或结束时间。');
      timingFields = { timing, durationMinutes: value.durationMinutes };
    } else if (timing === 'fixed') timingFields = { timing: 'fixed' };
    if (timing === 'window') {
      if (value.plannedStart != null && value.plannedStart !== '') {
        if (typeof value.plannedStart !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.plannedStart)) throw new Error('计划作答时间必须包含时区。');
        const planned = new Date(value.plannedStart);
        if (!Number.isFinite(+planned) || +planned < +start || +planned + value.durationMinutes * 60000 > +end) throw new Error('计划作答须在可选窗口内开始，并在截止前完成。');
        timingFields.plannedStart = planned.toISOString();
      }
    }
    for (const key of ['company', 'location', 'link', 'notes']) {
      if (value[key] != null && (typeof value[key] !== 'string' || value[key].length > (key === 'notes' ? 5000 : 1000))) throw new Error('日程文字过长或格式不正确。');
    }
    const link = (value.link ?? '').trim();
    if (link) {
      try { if (!['http:', 'https:'].includes(new URL(link).protocol)) throw new Error(); }
      catch { throw new Error('会议链接需要以 https:// 或 http:// 开头。'); }
    }
    return { id: value.id, title: value.title.trim(), company: (value.company ?? '').trim(), type: value.type,
      color: value.color, start: start.toISOString(), end: end.toISOString(), location: (value.location ?? '').trim(), link, notes: (value.notes ?? '').trim(),
      ...(value.timeZone ? { timeZone: value.timeZone } : {}), ...timingFields };
  });
}

/** @param {ScheduleEvent[]} events */
export function findConflicts(events) {
  const sorted = events.flatMap(event => { const range = occupiedRange(event); return range ? [{ event, ...range }] : []; })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (+new Date(b.start) >= +new Date(a.end)) break;
      const start = Math.max(+new Date(a.start), +new Date(b.start));
      const end = Math.min(+new Date(a.end), +new Date(b.end));
      if (start < end) pairs.push({ a: a.event, b: b.event, start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes: (end - start) / 60000 });
    }
  }
  return pairs;
}

/** A window only occupies time after a concrete start has been chosen. */
export function occupiedRange(event) {
  if (event.timing !== 'window') return { start: event.start, end: event.end };
  return event.plannedStart ? { start: event.plannedStart, end: new Date(+new Date(event.plannedStart) + event.durationMinutes * 60000).toISOString() } : null;
}
/** Continuous free intervals that can fit the entire exam; pending windows do not block each other.
 * @param {ScheduleEvent} event
 * @param {ScheduleEvent[]} events
 * @param {string | number | Date | null} [notBefore]
 */
export function availableSlots(event, events, notBefore = null) {
  if (event.timing !== 'window' || !Number.isInteger(event.durationMinutes) || event.durationMinutes < 1) return [];
  const start = Math.max(+new Date(event.start), notBefore == null ? -Infinity : +new Date(notBefore));
  const end = +new Date(event.end), required = event.durationMinutes * 60000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];
  const blocked = events.filter(item => item.id !== event.id).flatMap(item => {
    const range = occupiedRange(item);
    if (!range) return [];
    const first = Math.max(start, +new Date(range.start)), last = Math.min(end, +new Date(range.end));
    return first < last ? [{ start: first, end: last }] : [];
  }).sort((a, b) => a.start - b.start);
  let cursor = start;
  const free = [];
  const append = (first, last) => { if (last - first >= required) free.push({ start: new Date(first).toISOString(), end: new Date(last).toISOString(), minutes: (last - first) / 60000 }); };
  for (const interval of blocked) { append(cursor, interval.start); cursor = Math.max(cursor, interval.end); }
  append(cursor, end);
  return free;
}

/** Events in each connected overlap group share columns, so chains never cover each other. */
export function layoutSegments(segments) {
  const sorted = [...segments].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute || a.event.id.localeCompare(b.event.id));
  const result = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const laneEnds = [];
    const positioned = group.map(segment => {
      let lane = laneEnds.findIndex(end => end <= segment.startMinute);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = segment.endMinute;
      return { ...segment, lane };
    });
    result.push(...positioned.map(segment => ({ ...segment, lanes: laneEnds.length })));
    group = [];
  };
  for (const segment of sorted) {
    if (segment.startMinute >= groupEnd) flush();
    group.push(segment);
    groupEnd = Math.max(groupEnd, segment.endMinute);
  }
  flush();
  return result;
}
