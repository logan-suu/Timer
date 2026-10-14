import test from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts, layoutSegments, validateEvents } from '../shared/domain.mjs';

const make = (id, start, end) => ({ id, title: '技术面试', company: '公司', type: 'interview', color: 'blue', start, end, location: '', link: '', notes: '' });
const event = (id, start, end) => make(id, `2026-10-09T${start}:00+08:00`, `2026-10-09T${end}:00+08:00`);

test('strict overlap distinguishes touching boundaries and reports exact shared time', () => {
  const a = event('a', '14:00', '16:00');
  const b = event('b', '15:00', '16:30');
  const c = event('c', '16:30', '17:30');
  const pairs = findConflicts([c, b, a]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].minutes, 60);
  assert.equal(pairs[0].start, '2026-10-09T07:00:00.000Z');
  assert.equal(pairs[0].end, '2026-10-09T08:00:00.000Z');
});
test('nested, identical, and overnight events all produce the correct pairs', () => {
  const events = [make('a', '2026-10-09T23:00:00+08:00', '2026-10-10T02:00:00+08:00'),
    make('b', '2026-10-10T00:30:00+08:00', '2026-10-10T01:00:00+08:00'),
    make('c', '2026-10-10T00:30:00+08:00', '2026-10-10T01:00:00+08:00')];
  assert.equal(findConflicts(events).length, 3);
  assert.ok(findConflicts(events).every(pair => pair.minutes === 30));
});
test('chains use consistent lanes without covering each other', () => {
  const segments = [
    { event: { id: 'a' }, startMinute: 540, endMinute: 630 },
    { event: { id: 'b' }, startMinute: 600, endMinute: 690 },
    { event: { id: 'c' }, startMinute: 660, endMinute: 720 },
    { event: { id: 'd' }, startMinute: 720, endMinute: 780 },
  ];
  const laidOut = layoutSegments(segments);
  assert.deepEqual(laidOut.map(value => value.lanes), [2, 2, 2, 1]);
  assert.deepEqual(laidOut.map(value => value.lane), [0, 1, 0, 0]);
});
test('validation rejects invalid ranges, duplicates and unsafe links without losing records', () => {
  const valid = event('a', '14:00', '16:00');
  assert.equal(validateEvents([valid])[0].start, '2026-10-09T06:00:00.000Z');
  assert.throws(() => validateEvents([valid, valid]), /重复/);
  assert.throws(() => validateEvents([{ ...valid, end: valid.start }]), /晚于/);
  assert.throws(() => validateEvents([{ ...valid, link: 'javascript:alert(1)' }]), /链接/);
  assert.throws(() => validateEvents([{ ...valid, title: '   ' }]), /名称/);
  assert.throws(() => validateEvents([{ ...valid, start: 'invalid' }]), /时间/);
});
