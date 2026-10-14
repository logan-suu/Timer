import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { availableSlots, findConflicts, occupiedRange, validateEvents, inferExamTiming } from '../shared/domain.mjs';
import { ScheduleStore } from '../server/store.mjs';
import { zonedInput as localInput, fromZonedInput } from '../shared/timezones.mjs';

const iso = hour => `2026-10-11T${String(hour).padStart(2, '0')}:00:00+08:00`;
const fixed = (id, start, end) => ({ id, title: '笔试', company: id, type: 'exam', color: 'purple', start: iso(start), end: iso(end), timeZone: 'Asia/Shanghai' });
const window = (id = 'window', start = 8, end = 21) => ({ ...fixed(id, start, end), timing: 'window', durationMinutes: 120 });

test('overlapping unplanned windows never occupy time or create conflicts', () => {
  const pending = window();
  assert.equal(occupiedRange(pending), null);
  assert.deepEqual(findConflicts([pending, window('another'), fixed('fixed', 10, 12)]), []);
});
test('planned exams use only their real duration while keeping their full window', () => {
  const planned = { ...window(), plannedStart: iso(11) };
  const pairs = findConflicts([planned, fixed('fixed', 10, 12)]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].minutes, 60);
  assert.equal(pairs[0].start, '2026-10-11T03:00:00.000Z');
  assert.equal(pairs[0].end, '2026-10-11T04:00:00.000Z');
  assert.equal(pairs[0].b, planned);
  assert.equal(planned.start, iso(8));
  assert.equal(planned.end, iso(21));
  assert.equal(occupiedRange(planned).end, '2026-10-11T05:00:00.000Z');
  assert.deepEqual(findConflicts([{ ...planned, plannedStart: iso(12) }, fixed('fixed', 10, 12)]), []);
});
test('two planned windows can conflict even though pending windows are ignored', () => {
  const events = [{ ...window('a'), plannedStart: iso(12) }, { ...window('b'), plannedStart: iso(13) }, window('pending')];
  const pairs = findConflicts(events);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].minutes, 60);
});
test('validation requires a real exam duration that fits the window', () => {
  for (const durationMinutes of [undefined, '', 0, -1, 1.5, 1441]) {
    assert.throws(() => validateEvents([{ ...window(), durationMinutes }]), /用时/);
  }
  assert.throws(() => validateEvents([{ ...window(), type: 'interview' }]), /仅用于笔试/);
  assert.throws(() => validateEvents([{ ...window('short', 8, 9) }]), /短于/);
  assert.throws(() => validateEvents([{ ...window(), timing: 'unknown' }]), /时间方式/);
});
test('planned starts must be zoned, after opening, and finish by the deadline', () => {
  for (const plannedStart of [iso(7), iso(20), 'invalidZ']) {
    assert.throws(() => validateEvents([{ ...window(), plannedStart }]), /窗口内/);
  }
  assert.throws(() => validateEvents([{ ...window(), plannedStart: '2026-10-11T12:00' }]), /时区/);
  const atDeadline = validateEvents([{ ...window(), plannedStart: iso(19) }])[0];
  assert.equal(occupiedRange(atDeadline).end, atDeadline.end);
});
test('availability clips and merges nested, overlapping and adjacent blockers', () => {
  const pending = window();
  const busy = [fixed('before', 7, 9), fixed('nested', 8, 9), fixed('a', 10, 12), fixed('b', 11, 13), fixed('adjacent', 13, 14), fixed('late', 18, 22)];
  const slots = availableSlots(pending, [...busy, pending, window('other-pending')]);
  assert.deepEqual(slots, [{ start: '2026-10-11T06:00:00.000Z', end: '2026-10-11T10:00:00.000Z', minutes: 240 }]);
});
test('a two hour exam needs a continuous block, not several separate gaps', () => {
  const pending = window('short', 8, 14);
  assert.deepEqual(availableSlots(pending, [fixed('a', 9, 10), fixed('b', 11, 12), fixed('c', 13, 14)]), []);
});
test('availability excludes the exam itself and respects other actual planned ranges', () => {
  const planned = { ...window('self'), plannedStart: iso(8) };
  const other = { ...window('other'), plannedStart: iso(10) };
  const slots = availableSlots(planned, [planned, other, window('pending')]);
  assert.deepEqual(slots.map(slot => slot.minutes), [120, 540]);
  assert.equal(slots[1].start, '2026-10-11T04:00:00.000Z');
});
test('suggestions can exclude elapsed time without changing the saved opening time', () => {
  const pending = window();
  const slots = availableSlots(pending, [fixed('a', 10, 12)], iso(11));
  assert.equal(slots[0].start, '2026-10-11T04:00:00.000Z');
  assert.deepEqual(availableSlots(pending, [], iso(20)), []);
  assert.equal(pending.start, iso(8));
});
test('a two hour planned exam across fall-back uses elapsed time rather than wall-clock subtraction', () => {
  const start = fromZonedInput('2026-11-01T01:30', 'America/Chicago', 'earlier');
  const planned = validateEvents([{ ...window(), timeZone: 'America/Chicago', start: '2026-11-01T06:00:00Z', end: '2026-11-01T09:00:00Z', plannedStart: start.toISOString() }])[0];
  const actual = occupiedRange(planned);
  assert.equal(localInput(actual.start, 'America/Chicago'), '2026-11-01T01:30');
  assert.equal(localInput(actual.end, 'America/Chicago'), '2026-11-01T02:30');
  assert.equal((+new Date(actual.end) - +new Date(actual.start)) / 60000, 120);
  assert.equal(findConflicts([planned, { ...fixed('busy', 10, 12), start: '2026-11-01T08:00:00Z', end: '2026-11-01T09:00:00Z' }])[0].minutes, 30);
});
test('window metadata, pending status and chosen time survive restart and backup', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'career-window-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const settings = { displayTimeZone: 'America/Chicago', inputTimeZone: 'Asia/Shanghai', comparisonTimeZone: 'Asia/Shanghai' };
  const store = new ScheduleStore(dir);
  const pending = validateEvents([window()])[0];
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [pending], settings });
  const planned = { ...pending, plannedStart: '2026-10-11T04:00:00.000Z' };
  await store.write({ expectedRevision: 1, demoDismissed: true, events: [planned], settings });
  const restored = await new ScheduleStore(dir).read();
  assert.deepEqual(restored.events, [planned]);
  assert.deepEqual(restored.settings, settings);
  const backup = JSON.parse(await readFile(path.join(dir, 'schedule.backup.json'), 'utf8'));
  assert.deepEqual(validateEvents(backup.events), [pending]);
});
test('legacy events stay fixed and equal duration preserves duration while clearing obsolete plans', () => {
  const legacy = validateEvents([fixed('legacy', 10, 12)])[0];
  assert.deepEqual(occupiedRange(legacy), { start: legacy.start, end: legacy.end });
  const changed = validateEvents([{ ...window('equal', 10, 12), plannedStart: iso(10) }])[0];
  assert.equal(changed.durationMinutes, 120);
  assert.equal(changed.plannedStart, undefined);
  assert.equal(changed.timing, 'fixed');
});

test('exam timing is inferred at the exact duration boundary', () => {
  assert.equal(inferExamTiming(iso(10), iso(12), 120), 'fixed');
  assert.equal(inferExamTiming(iso(10), '2026-10-11T12:01:00+08:00', 120), 'window');
  assert.equal(inferExamTiming(iso(10), '2026-10-11T11:59:00+08:00', 120), null);
  for (const duration of [0, -1, 1.5, 1441, NaN]) assert.equal(inferExamTiming(iso(10), iso(12), duration), null);
  assert.equal(inferExamTiming('invalid', iso(12), 120), null);
});
test('save/import classification follows the supplied duration, including custom values', () => {
  const equal = validateEvents([{ ...fixed('equal', 10, 12), durationMinutes: 120 }])[0];
  assert.equal(equal.timing, 'fixed');
  assert.equal(equal.durationMinutes, 120);
  const flexible = validateEvents([{ ...fixed('flexible', 10, 12), timing: 'fixed', durationMinutes: 100 }])[0];
  assert.equal(flexible.timing, 'window');
  assert.equal(flexible.durationMinutes, 100);
  assert.equal(occupiedRange(flexible), null);
  assert.throws(() => validateEvents([{ ...fixed('short', 10, 12), durationMinutes: 121 }]), /短于笔试时长/);
  assert.throws(() => validateEvents([{ ...fixed('invalid', 10, 12), durationMinutes: 1.5 }]), /用时/);
});
test('inference is identical in both zones and uses real duration on DST transition days', () => {
  const first = fromZonedInput('2026-11-01T01:00', 'America/Chicago', 'earlier');
  const second = fromZonedInput('2026-11-01T01:00', 'America/Chicago', 'later');
  assert.equal(inferExamTiming(first, second, 60), 'fixed');
  assert.equal(inferExamTiming(first, second, 30), 'window');
  assert.equal(inferExamTiming(first, second, 90), null);
  const springStart = fromZonedInput('2026-03-08T01:30', 'America/Chicago');
  const springEnd = fromZonedInput('2026-03-08T03:30', 'America/Chicago');
  assert.equal(inferExamTiming(springStart, springEnd, 60), 'fixed');
  const beijingStart = fromZonedInput(localInput(first, 'Asia/Shanghai'), 'Asia/Shanghai');
  const beijingEnd = fromZonedInput(localInput(second, 'Asia/Shanghai'), 'Asia/Shanghai');
  assert.equal(inferExamTiming(beijingStart, beijingEnd, 60), 'fixed');
});
test('fixed exams keep the selected duration through save, fresh store and backup', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'career-fixed-duration-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ScheduleStore(dir);
  const value = validateEvents([{ ...fixed('fixed', 10, 12), durationMinutes: 120 }])[0];
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [value] });
  assert.deepEqual((await new ScheduleStore(dir).read()).events, [value]);
  await store.write({ expectedRevision: 1, demoDismissed: true, events: [{ ...value, notes: '补充备注' }] });
  const backup = JSON.parse(await readFile(path.join(dir, 'schedule.backup.json'), 'utf8'));
  assert.deepEqual(validateEvents(backup.events), [value]);
});
