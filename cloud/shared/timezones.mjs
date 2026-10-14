import { Temporal } from '@js-temporal/polyfill';

export const CHICAGO = 'America/Chicago';
export const BEIJING = 'Asia/Shanghai';
const ZONE_CACHE = new Map();
const CITY_NAMES = {
  'America/Chicago': '芝加哥', 'Asia/Shanghai': '北京', 'America/New_York': '纽约',
  'America/Los_Angeles': '洛杉矶', 'America/Denver': '丹佛', 'America/Phoenix': '凤凰城',
  'America/Anchorage': '安克雷奇', 'Pacific/Honolulu': '檀香山', 'America/Toronto': '多伦多',
  'America/Vancouver': '温哥华', 'America/Mexico_City': '墨西哥城', 'America/Sao_Paulo': '圣保罗',
  'America/Argentina/Buenos_Aires': '布宜诺斯艾利斯', 'America/Santiago': '圣地亚哥', 'America/Bogota': '波哥大',
  'America/Lima': '利马', 'Europe/London': '伦敦', 'Europe/Paris': '巴黎', 'Europe/Berlin': '柏林',
  'Europe/Madrid': '马德里', 'Europe/Rome': '罗马', 'Europe/Amsterdam': '阿姆斯特丹',
  'Europe/Zurich': '苏黎世', 'Europe/Athens': '雅典', 'Europe/Helsinki': '赫尔辛基',
  'Europe/Moscow': '莫斯科', 'Europe/Istanbul': '伊斯坦布尔', 'Asia/Tokyo': '东京',
  'Asia/Seoul': '首尔', 'Asia/Hong_Kong': '香港', 'Asia/Taipei': '台北', 'Asia/Singapore': '新加坡',
  'Asia/Kuala_Lumpur': '吉隆坡', 'Asia/Bangkok': '曼谷', 'Asia/Jakarta': '雅加达',
  'Asia/Manila': '马尼拉', 'Asia/Ho_Chi_Minh': '胡志明市', 'Asia/Calcutta': '加尔各答',
  'Asia/Kolkata': '加尔各答', 'Asia/Katmandu': '加德满都', 'Asia/Kathmandu': '加德满都',
  'Asia/Dhaka': '达卡', 'Asia/Karachi': '卡拉奇', 'Asia/Colombo': '科伦坡',
  'Asia/Dubai': '迪拜', 'Asia/Riyadh': '利雅得', 'Asia/Jerusalem': '耶路撒冷',
  'Asia/Tehran': '德黑兰', 'Asia/Kabul': '喀布尔', 'Africa/Cairo': '开罗',
  'Africa/Johannesburg': '约翰内斯堡', 'Africa/Lagos': '拉各斯', 'Africa/Nairobi': '内罗毕',
  'Africa/Casablanca': '卡萨布兰卡', 'Australia/Sydney': '悉尼', 'Australia/Melbourne': '墨尔本',
  'Australia/Brisbane': '布里斯班', 'Australia/Perth': '珀斯', 'Australia/Adelaide': '阿德莱德',
  'Australia/Darwin': '达尔文', 'Australia/Lord_Howe': '豪勋爵岛', 'Pacific/Auckland': '奥克兰',
  'Pacific/Chatham': '查塔姆群岛', 'Pacific/Fiji': '斐济', 'Pacific/Apia': '阿皮亚',
  'Pacific/Kiritimati': '基里蒂马蒂', 'Atlantic/Reykjavik': '雷克雅未克',
};
export function isValidTimeZone(zone) {
  if (typeof zone !== 'string' || !/^[A-Za-z][A-Za-z0-9_+./-]{0,99}$/.test(zone)) return false;
  try { canonicalTimeZone(zone); return true; } catch { return false; }
}
export function canonicalTimeZone(zone) {
  if (!ZONE_CACHE.has(zone)) ZONE_CACHE.set(zone, new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone);
  return ZONE_CACHE.get(zone);
}
const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : Object.keys(CITY_NAMES);
export const TIME_ZONES = [...new Set(['UTC', ...supported, ...Object.keys(CITY_NAMES).filter(isValidTimeZone)])].sort();
// Original defaults are retained for old stored documents; new users use their device zone.
export const DEFAULT_SETTINGS = { displayTimeZone: CHICAGO, inputTimeZone: BEIJING, comparisonTimeZone: BEIJING };
export function zoneLabel(zone) {
  if (canonicalTimeZone(zone) === 'UTC') return 'UTC';
  return `${CITY_NAMES[zone] || CITY_NAMES[canonicalTimeZone(zone)] || zone.split('/').at(-1).replaceAll('_', ' ')}时间`;
}
export function deviceTimeZone() {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : 'UTC';
}
export function browserDefaultSettings(zone = deviceTimeZone()) {
  return { displayTimeZone: zone, inputTimeZone: BEIJING, comparisonTimeZone: canonicalTimeZone(zone) === canonicalTimeZone(BEIJING) ? 'UTC' : BEIJING };
}
// Kept only for interpreting the original two-zone settings and older callers.
export const otherZone = zone => zone === CHICAGO ? BEIJING : CHICAGO;
export function validateSettings(value) {
  if (value == null) return { ...DEFAULT_SETTINGS };
  const comparison = value.comparisonTimeZone ?? (isValidTimeZone(value.displayTimeZone) && canonicalTimeZone(value.displayTimeZone) === canonicalTimeZone(BEIJING) ? CHICAGO : BEIJING);
  if (![value.displayTimeZone, value.inputTimeZone, comparison].every(isValidTimeZone)) throw new Error('请选择有效的城市时区。');
  if (canonicalTimeZone(value.displayTimeZone) === canonicalTimeZone(comparison)) throw new Error('日历时区与对照时区需要不同。');
  return { displayTimeZone: value.displayTimeZone, inputTimeZone: value.inputTimeZone, comparisonTimeZone: comparison };
}
export function zoned(value, zone) {
  return Temporal.Instant.from(new Date(value).toISOString()).toZonedDateTimeISO(zone);
}
export function zonedDateKey(value, zone) { return zoned(value, zone).toPlainDate().toString(); }
export function zonedTimeLabel(value, zone) { return zoned(value, zone).toPlainTime().toString({ smallestUnit: 'minute' }); }
export function zonedInput(value, zone) { return zoned(value, zone).toPlainDateTime().toString({ smallestUnit: 'minute' }); }

/** Return zero instants for a skipped hour, two for a repeated hour. No implicit DST guessing. */
export function possibleInstants(value, zone) {
  if (!isValidTimeZone(zone)) throw new Error('不支持这个时区。');
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
export function dayStart(day, zone) { return new Date(Temporal.PlainDate.from(day).toZonedDateTime(zone).epochMilliseconds); }
export function offsetHoursApart(value, firstZone = CHICAGO, secondZone = BEIJING) { return (zoned(value, secondZone).offsetNanoseconds - zoned(value, firstZone).offsetNanoseconds) / 3600000000000; }
export function differenceLabel(value, firstZone, secondZone) {
  const minutes = Math.round(offsetHoursApart(value, firstZone, secondZone) * 60);
  if (minutes === 0) return `${zoneLabel(firstZone)}与${zoneLabel(secondZone)}没有时差`;
  const total = Math.abs(minutes), hours = Math.floor(total / 60), rest = total % 60;
  return `${zoneLabel(secondZone)}比${zoneLabel(firstZone)}${minutes > 0 ? '快' : '慢'} ${hours ? `${hours} 小时` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} 分钟` : ''}`;
}
export function zoneRangeInfo(start, end, zone, comparisonZone) {
  const first = zoned(start, zone), last = zoned(end, zone);
  const comparisonStart = zoned(start, comparisonZone), comparisonEnd = zoned(end, comparisonZone);
  return { startOffset: first.offset, endOffset: last.offset, comparisonStartOffset: comparisonStart.offset,
    comparisonEndOffset: comparisonEnd.offset,
    crossesTransition: first.offset !== last.offset || comparisonStart.offset !== comparisonEnd.offset,
    minutes: (+new Date(end) - +new Date(start)) / 60000 };
}
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
  const first = zoned(start, zone), last = zoned(end, zone);
  const repeated = [start, end].some(value => possibleInstants(zonedInput(value, zone), zone).length > 1);
  if (canonicalTimeZone(zone) !== CHICAGO) {
    if (first.offset !== last.offset) return `${zoneLabel(zone)}·UTC${first.offset}→UTC${last.offset}`;
    return `${zoneLabel(zone)}${repeated ? `·UTC${first.offset}` : ''}`;
  }
  const season = info => info.abbreviation === 'CDT' ? '夏令时' : '冬令时';
  if (first.offset !== last.offset) return `${zoneLabel(zone)}·${season(chicagoClockInfo(start))}→${season(chicagoClockInfo(end))}`;
  return `${zoneLabel(zone)}${repeated ? `·${season(chicagoClockInfo(start))}` : ''}`;
}
export function timeWithZone(value, zone) {
  return `${zonedTimeLabel(value, zone)}（${rangeZoneLabel(value, value, zone)}）`;
}

/** Absolute day boundaries correctly include 23-hour and 25-hour DST days. */
export function calendarSegments(events, day, zone) {
  const start = +dayStart(day, zone);
  const end = +dayStart(addCalendarDays(day, 1), zone);
  if (end <= start) return [];
  return events.filter(event => +new Date(event.start) < end && +new Date(event.end) > start).map(event => ({
    event, startMinute: (Math.max(start, +new Date(event.start)) - start) / 60000,
    endMinute: (Math.min(end, +new Date(event.end)) - start) / 60000,
  }));
}
