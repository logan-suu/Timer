import test from 'node:test';
import assert from 'node:assert/strict';
import { CHICAGO, BEIJING, fromZonedInput, possibleInstants, zonedInput, zonedDateKey, dayStart,
  calendarSegments, weekStart, offsetHoursApart, validateSettings, chicagoClockInfo, chicagoRangeInfo, timeWithZone, rangeZoneLabel } from '../shared/timezones.mjs';
import { findConflicts, validateEvents } from '../shared/domain.mjs';

const event = (id, start, end, zone) => ({ id, title: '面试', company: '测试公司', type: 'interview', color: 'blue',
  start: fromZonedInput(start, zone).toISOString(), end: fromZonedInput(end, zone).toISOString(), timeZone: zone, location: '', link: '', notes: '' });

test('Beijing appointments convert to Chicago with the correct previous date in summer and winter', () => {
  const summer = fromZonedInput('2026-10-10T09:00', BEIJING);
  assert.equal(zonedInput(summer, CHICAGO), '2026-10-09T20:00');
  assert.equal(offsetHoursApart(summer), 13);
  const winter = fromZonedInput('2026-12-10T09:00', BEIJING);
  assert.equal(zonedInput(winter, CHICAGO), '2026-12-09T19:00');
  assert.equal(offsetHoursApart(winter), 14);
});
test('round trip preserves the absolute instant independently of the machine timezone', () => {
  const instant = fromZonedInput('2026-10-09T21:30', CHICAGO);
  assert.equal(zonedInput(instant, BEIJING), '2026-10-10T10:30');
  assert.equal(+fromZonedInput(zonedInput(instant, BEIJING), BEIJING), +instant);
});
test('spring-forward nonexistent times are rejected rather than silently moved', () => {
  assert.deepEqual(possibleInstants('2026-03-08T02:30', CHICAGO), []);
  assert.throws(() => fromZonedInput('2026-03-08T02:30', CHICAGO), /不存在/);
  assert.equal(possibleInstants('2026-03-08T02:30', BEIJING).length, 1);
});
test('fall-back repeated hours require an explicit selection', () => {
  const choices = possibleInstants('2026-11-01T01:30', CHICAGO);
  assert.deepEqual(choices.map(choice => choice.offset), ['-05:00', '-06:00']);
  assert.throws(() => fromZonedInput('2026-11-01T01:30', CHICAGO), /出现两次/);
  assert.equal(+fromZonedInput('2026-11-01T01:30', CHICAGO, 'later') - +fromZonedInput('2026-11-01T01:30', CHICAGO, 'earlier'), 3600000);
});
test('clock labels name their timezone and distinguish both occurrences of the fall-back hour', () => {
  const first = fromZonedInput('2026-11-01T01:30', CHICAGO, 'earlier');
  const second = fromZonedInput('2026-11-01T01:30', CHICAGO, 'later');
  assert.equal(timeWithZone(first, CHICAGO), '01:30（芝加哥时间·夏令时）');
  assert.equal(timeWithZone(second, CHICAGO), '01:30（芝加哥时间·冬令时）');
  assert.equal(timeWithZone(first, BEIJING), '14:30（北京时间）');
  assert.equal(timeWithZone(second, BEIJING), '15:30（北京时间）');
  assert.equal(rangeZoneLabel(first, second, CHICAGO), '芝加哥时间·夏令时→冬令时');
  assert.equal(rangeZoneLabel('2026-03-08T07:30:00Z', '2026-03-08T08:30:00Z', CHICAGO), '芝加哥时间·冬令时→夏令时');
});
test('future autumn appointments use the offset at the appointment date, not the current date', () => {
  const before = fromZonedInput('2026-10-31T09:00', BEIJING);
  const after = fromZonedInput('2026-11-02T09:00', BEIJING);
  assert.equal(zonedInput(before, CHICAGO), '2026-10-30T20:00');
  assert.equal(zonedInput(after, CHICAGO), '2026-11-01T19:00');
  assert.deepEqual(chicagoClockInfo(before), {offset:'-05:00',abbreviation:'CDT',label:'夏令时',differenceHours:13});
  assert.deepEqual(chicagoClockInfo(after), {offset:'-06:00',abbreviation:'CST',label:'标准时间（冬令时）',differenceHours:14});
});
test('the exact fall-back instant changes offset and a crossing event keeps actual duration', () => {
  assert.equal(chicagoClockInfo('2026-11-01T06:59:59.999Z').abbreviation, 'CDT');
  assert.equal(chicagoClockInfo('2026-11-01T07:00:00.000Z').abbreviation, 'CST');
  const range = chicagoRangeInfo('2026-11-01T06:45:00.000Z', '2026-11-01T07:15:00.000Z');
  assert.equal(range.crossesTransition, true);
  assert.equal(range.start.differenceHours, 13);
  assert.equal(range.end.differenceHours, 14);
  assert.equal(range.minutes, 30);
});
test('identical wall times in the two repeated hours remain distinct and do not falsely conflict', () => {
  const first = {id:'first',start:fromZonedInput('2026-11-01T01:00',CHICAGO,'earlier').toISOString(),end:fromZonedInput('2026-11-01T01:30',CHICAGO,'earlier').toISOString()};
  const second = {id:'second',start:fromZonedInput('2026-11-01T01:00',CHICAGO,'later').toISOString(),end:fromZonedInput('2026-11-01T01:30',CHICAGO,'later').toISOString()};
  assert.equal(findConflicts([first,second]).length,0);
  const segments=calendarSegments([first,second],'2026-11-01',CHICAGO);
  assert.equal(segments[0].startMinute,60);
  assert.equal(segments[1].startMinute,120);
});
test('DST day boundaries span 23 or 25 hours instead of a hardcoded 24', () => {
  assert.equal((+dayStart('2026-03-09', CHICAGO) - +dayStart('2026-03-08', CHICAGO)) / 3600000, 23);
  assert.equal((+dayStart('2026-11-02', CHICAGO) - +dayStart('2026-11-01', CHICAGO)) / 3600000, 25);
});
test('week and day placement use the selected timezone even across Sunday / Monday', () => {
  const item = event('one', '2026-10-12T09:00', '2026-10-12T10:00', BEIJING);
  assert.equal(zonedDateKey(item.start, CHICAGO), '2026-10-11');
  assert.equal(weekStart(zonedDateKey(item.start, CHICAGO)), '2026-10-05');
  assert.equal(weekStart(zonedDateKey(item.start, BEIJING)), '2026-10-12');
  assert.equal(calendarSegments([item], '2026-10-11', CHICAGO)[0].startMinute, 1200);
  assert.equal(calendarSegments([item], '2026-10-12', BEIJING)[0].startMinute, 540);
});
test('midnight-spanning events split at local midnight and touching midnight never leaks into next day', () => {
  const item = event('one', '2026-10-09T23:30', '2026-10-10T00:30', CHICAGO);
  assert.equal(calendarSegments([item], '2026-10-09', CHICAGO)[0].endMinute, 1440);
  assert.equal(calendarSegments([item], '2026-10-10', CHICAGO)[0].startMinute, 0);
  const touching = { ...item, end: dayStart('2026-10-10', CHICAGO).toISOString() };
  assert.equal(calendarSegments([touching], '2026-10-10', CHICAGO).length, 0);
});
test('cross-zone conflicts compare instants, not displayed wall clock labels', () => {
  const china = event('a', '2026-10-10T09:00', '2026-10-10T10:00', BEIJING);
  const chicago = event('b', '2026-10-09T20:30', '2026-10-09T21:30', CHICAGO);
  assert.equal(findConflicts([china, chicago])[0].minutes, 30);
  const sameClock = event('c', '2026-10-10T09:00', '2026-10-10T10:00', CHICAGO);
  assert.equal(findConflicts([china, sameClock]).length, 0);
});
test('fall-back event segments preserve real duration when clock end is earlier than clock start', () => {
  const start = fromZonedInput('2026-11-01T01:45', CHICAGO, 'earlier').toISOString();
  const end = fromZonedInput('2026-11-01T01:15', CHICAGO, 'later').toISOString();
  const segment = calendarSegments([{ start, end }], '2026-11-01', CHICAGO)[0];
  assert.equal(segment.endMinute - segment.startMinute, 30);
});
test('event validation preserves source timezone and rejects ambiguous offsetless backup data', () => {
  const original = event('one', '2026-10-10T09:00', '2026-10-10T10:00', BEIJING);
  assert.equal(validateEvents([original])[0].timeZone, BEIJING);
  assert.throws(() => validateEvents([{ ...original, start: '2026-10-10T09:00:00' }]), /必须包含时区/);
  assert.throws(() => validateEvents([{ ...original, timeZone: 'Invalid/Zone' }]), /时区不正确/);
  assert.throws(() => validateSettings({ displayTimeZone: 'Invalid/Zone', inputTimeZone: BEIJING }), /请选择/);
});
