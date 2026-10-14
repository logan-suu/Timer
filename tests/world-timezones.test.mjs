import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TIME_ZONES, isValidTimeZone, zoneLabel, browserDefaultSettings, validateSettings, zonedInput,
  fromZonedInput, possibleInstants, dayStart, calendarSegments, offsetHoursApart, differenceLabel, zoneRangeInfo, rangeZoneLabel } from '../shared/timezones.mjs';
import { validateEvents, findConflicts, occupiedRange } from '../shared/domain.mjs';
import { ScheduleStore } from '../server/store.mjs';

test('named world zones and aliases are accepted, invalid zones and bare offsets are rejected', () => {
  assert.ok(TIME_ZONES.length > 300);
  for (const zone of ['UTC', 'Europe/London', 'Asia/Kolkata', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/Argentina/Buenos_Aires', 'US/Eastern']) assert.ok(isValidTimeZone(zone), zone);
  for (const zone of ['Invalid/Zone', '+05:30', '', '../../secret', null, 123]) assert.ok(!isValidTimeZone(zone));
  assert.equal(zoneLabel('Europe/London'), '伦敦时间');
  assert.equal(zoneLabel('Asia/Tokyo'), '东京时间');
  assert.equal(zoneLabel('UTC'), 'UTC');
});

test('new users use the device zone; old two-zone settings preserve their original counterpart', () => {
  assert.deepEqual(browserDefaultSettings('Asia/Tokyo'), { displayTimeZone: 'Asia/Tokyo', inputTimeZone: 'Asia/Shanghai', comparisonTimeZone: 'Asia/Shanghai' });
  assert.equal(browserDefaultSettings('Asia/Shanghai').comparisonTimeZone, 'UTC');
  assert.deepEqual(validateSettings({ displayTimeZone: 'Asia/Shanghai', inputTimeZone: 'America/Chicago' }), { displayTimeZone: 'Asia/Shanghai', inputTimeZone: 'America/Chicago', comparisonTimeZone: 'America/Chicago' });
  assert.equal(validateSettings({ displayTimeZone: 'America/Chicago', inputTimeZone: 'Asia/Shanghai' }).comparisonTimeZone, 'Asia/Shanghai');
  assert.throws(() => validateSettings({ displayTimeZone: 'UTC', inputTimeZone: 'Asia/Tokyo', comparisonTimeZone: 'Etc/UTC' }), /需要不同/);
  assert.throws(() => validateSettings({ displayTimeZone: 'Europe/London', inputTimeZone: 'Asia/Tokyo', comparisonTimeZone: 'Fake/Zone' }), /有效/);
});

test('half-hour and quarter-hour offsets retain every minute across UTC and date boundaries', () => {
  assert.equal(fromZonedInput('2026-10-14T00:15', 'Asia/Kathmandu').toISOString(), '2026-10-13T18:30:00.000Z');
  assert.equal(zonedInput('2026-10-13T18:30:00Z', 'Asia/Kolkata'), '2026-10-14T00:00');
  assert.equal(offsetHoursApart('2026-07-01T12:00:00Z', 'UTC', 'Asia/Kathmandu'), 5.75);
  assert.match(differenceLabel('2026-07-01T12:00:00Z', 'UTC', 'Asia/Kathmandu'), /快 5 小时 45 分钟/);
  assert.match(differenceLabel('2026-07-01T12:00:00Z', 'Asia/Kolkata', 'UTC'), /慢 5 小时 30 分钟/);
  assert.equal(zonedInput('2026-07-01T12:00:00Z', 'Pacific/Chatham'), '2026-07-02T00:45');
});

test('Europe and North America change DST on different dates, so the same pair changes difference', () => {
  assert.equal(offsetHoursApart('2026-03-16T12:00:00Z', 'America/New_York', 'Europe/London'), 4);
  assert.equal(offsetHoursApart('2026-04-16T12:00:00Z', 'America/New_York', 'Europe/London'), 5);
  assert.deepEqual(possibleInstants('2026-03-29T01:30', 'Europe/London'), []);
  const repeated = possibleInstants('2026-10-25T01:30', 'Europe/London');
  assert.deepEqual(repeated.map(value => value.offset), ['+01:00', '+00:00']);
  assert.match(rangeZoneLabel(repeated[0].iso, repeated[0].iso, 'Europe/London'), /UTC\+01:00/);
  assert.match(rangeZoneLabel(repeated[1].iso, repeated[1].iso, 'Europe/London'), /UTC\+00:00/);
  assert.throws(() => fromZonedInput('2026-10-25T01:30', 'Europe/London'), /出现两次/);
});

test('southern-hemisphere DST has the opposite season and retains 23/25-hour days', () => {
  assert.deepEqual(possibleInstants('2026-10-04T02:30', 'Australia/Sydney'), []);
  assert.equal(possibleInstants('2026-04-05T02:30', 'Australia/Sydney').length, 2);
  assert.equal((+dayStart('2026-10-05', 'Australia/Sydney') - +dayStart('2026-10-04', 'Australia/Sydney')) / 3600000, 23);
  assert.equal((+dayStart('2026-04-06', 'Australia/Sydney') - +dayStart('2026-04-05', 'Australia/Sydney')) / 3600000, 25);
});

test('Lord Howe changes by 30 minutes rather than an assumed one hour', () => {
  assert.deepEqual(possibleInstants('2026-10-04T02:15', 'Australia/Lord_Howe'), []);
  const repeated = possibleInstants('2026-04-05T01:45', 'Australia/Lord_Howe');
  assert.equal(+new Date(repeated[1].iso) - +new Date(repeated[0].iso), 1800000);
  assert.equal((+dayStart('2026-10-05', 'Australia/Lord_Howe') - +dayStart('2026-10-04', 'Australia/Lord_Howe')) / 3600000, 23.5);
  assert.equal((+dayStart('2026-04-06', 'Australia/Lord_Howe') - +dayStart('2026-04-05', 'Australia/Lord_Howe')) / 3600000, 24.5);
});

test('a skipped midnight starts at the first valid time and a skipped date has no segments', () => {
  assert.equal(zonedInput(dayStart('2026-09-06', 'America/Santiago'), 'America/Santiago'), '2026-09-06T01:00');
  assert.equal((+dayStart('2026-09-07', 'America/Santiago') - +dayStart('2026-09-06', 'America/Santiago')) / 3600000, 23);
  assert.equal(+dayStart('2011-12-30', 'Pacific/Apia'), +dayStart('2011-12-31', 'Pacific/Apia'));
  assert.deepEqual(calendarSegments([{ start: '2011-12-29T00:00:00Z', end: '2012-01-01T00:00:00Z' }], '2011-12-30', 'Pacific/Apia'), []);
});

test('generic range information detects a transition in either selected timezone', () => {
  const range = zoneRangeInfo('2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', 'Asia/Tokyo', 'Europe/London');
  assert.equal(range.crossesTransition, true);
  assert.equal(range.startOffset, '+09:00');
  assert.equal(range.comparisonStartOffset, '+01:00');
  assert.equal(range.comparisonEndOffset, '+00:00');
  assert.equal(range.minutes, 60);
});

test('global source zones, comparison settings and chosen exam instants survive restart and backup', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'timer-world-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const settings = { displayTimeZone: 'Pacific/Auckland', inputTimeZone: 'Europe/London', comparisonTimeZone: 'Asia/Kathmandu' };
  const item = { id: 'global', title: '海外笔试', company: '', type: 'exam', color: 'purple', timeZone: 'Europe/London', timing: 'window', durationMinutes: 120, start: '2026-10-24T20:00:00.000Z', end: '2026-10-25T15:00:00.000Z', plannedStart: '2026-10-25T00:30:00.000Z', location: '', notes: '', link: '' };
  const store = new ScheduleStore(directory);
  await store.write({ expectedRevision: 0, demoDismissed: true, settings, events: [item] });
  const restored = await new ScheduleStore(directory).read();
  assert.deepEqual(restored.settings, settings);
  assert.deepEqual(restored.events, [item]);
  assert.equal(occupiedRange(restored.events[0]).end, '2026-10-25T02:30:00.000Z');
  const backup = JSON.parse(JSON.stringify(restored));
  assert.deepEqual(validateSettings(backup.settings), settings);
  assert.deepEqual(validateEvents(backup.events), [item]);
});

test('international date-line appointments use absolute instants for overlap', () => {
  const first = { id: 'east', start: fromZonedInput('2026-10-14T09:00', 'Pacific/Kiritimati').toISOString(), end: fromZonedInput('2026-10-14T10:00', 'Pacific/Kiritimati').toISOString() };
  const sameInstant = { id: 'west', start: fromZonedInput('2026-10-13T09:30', 'Pacific/Honolulu').toISOString(), end: fromZonedInput('2026-10-13T10:30', 'Pacific/Honolulu').toISOString() };
  assert.equal(findConflicts([first, sameInstant])[0].minutes, 30);
});
