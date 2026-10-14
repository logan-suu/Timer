import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSlotStart } from '../shared/planning.mjs';

test('timeline selections snap to quarters and keep the complete exam inside a free gap', () => {
  const slot = { start: '2026-10-11T04:00:00Z', end: '2026-10-11T11:00:00Z' };
  assert.equal(selectSlotStart(slot, +new Date('2026-10-11T07:38:00Z'), 120), '2026-10-11T07:45:00.000Z');
  assert.equal(selectSlotStart(slot, +new Date('2026-10-11T03:00:00Z'), 120), '2026-10-11T04:00:00.000Z');
  assert.equal(selectSlotStart(slot, +new Date('2026-10-11T10:45:00Z'), 120), '2026-10-11T09:00:00.000Z');
  assert.equal(selectSlotStart(slot, +new Date(slot.start), 421), null);
});
test('short or non-quarter gaps keep their precise boundaries instead of overlapping a blocker', () => {
  const slot = { start: '2026-10-11T04:07:00Z', end: '2026-10-11T06:07:00Z' };
  assert.equal(selectSlotStart(slot, +new Date('2026-10-11T05:00:00Z'), 120), '2026-10-11T04:07:00.000Z');
  assert.equal(selectSlotStart(slot, NaN, 120), null);
  assert.equal(selectSlotStart(slot, +new Date(slot.start), 0), null);
});
test('selection across fall-back and midnight reserves elapsed time, with distinct repeated-hour starts', () => {
  const slot = { start: '2026-11-01T06:00:00Z', end: '2026-11-01T10:00:00Z' };
  assert.equal(selectSlotStart(slot, +new Date('2026-11-01T06:30:00Z'), 120), '2026-11-01T06:30:00.000Z');
  assert.equal(selectSlotStart(slot, +new Date('2026-11-01T07:30:00Z'), 120), '2026-11-01T07:30:00.000Z');
  assert.equal(selectSlotStart(slot, +new Date('2026-11-01T09:30:00Z'), 120), '2026-11-01T08:00:00.000Z');
  const overnight = { start: '2026-10-11T04:30:00Z', end: '2026-10-11T07:00:00Z' };
  assert.equal(selectSlotStart(overnight, +new Date('2026-10-11T04:45:00Z'), 120), '2026-10-11T04:45:00.000Z');
});
