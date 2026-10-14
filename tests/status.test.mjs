import test from 'node:test';
import assert from 'node:assert/strict';
import { eventStatus, isPastStatus } from '../shared/status.mjs';

const instant = value => +new Date(value);
const fixed = { start: '2026-10-12T15:00:00Z', end: '2026-10-12T16:00:00Z' };
const window = { timing: 'window', start: '2026-10-12T12:00:00Z', end: '2026-10-13T12:00:00Z', durationMinutes: 120 };

test('fixed events change at the exact start and end; the end does not imply completion', () => {
  assert.equal(eventStatus(fixed, instant(fixed.start) - 1), 'upcoming');
  assert.equal(eventStatus(fixed, instant(fixed.start)), 'ongoing');
  assert.equal(eventStatus(fixed, instant(fixed.end) - 1), 'ongoing');
  assert.equal(eventStatus(fixed, instant(fixed.end)), 'ended');
});

test('unplanned windows become available on opening, then expire at the deadline', () => {
  assert.equal(eventStatus(window, instant(window.start) - 1), 'upcoming');
  assert.equal(eventStatus(window, instant(window.start)), 'available');
  assert.equal(eventStatus(window, instant(window.end) - 1), 'available');
  assert.equal(eventStatus(window, instant(window.end)), 'expired');
  assert.ok(isPastStatus('expired'));
  assert.ok(!isPastStatus('available'));
});

test('planned windows follow the chosen sitting even while the wider window remains open', () => {
  const planned = { ...window, plannedStart: '2026-10-12T15:00:00Z' };
  assert.equal(eventStatus(planned, instant('2026-10-12T14:59:59Z')), 'upcoming');
  assert.equal(eventStatus(planned, instant('2026-10-12T15:00:00Z')), 'ongoing');
  assert.equal(eventStatus(planned, instant('2026-10-12T17:00:00Z')), 'ended');
  assert.equal(eventStatus(planned, instant(window.end)), 'ended');
  assert.ok(isPastStatus('ended'));
  assert.ok(!isPastStatus('upcoming'));
  assert.ok(!isPastStatus('ongoing'));
});

test('Beijing and Chicago representations of the same instants produce identical statuses across midnight', () => {
  const beijing = { start: '2026-10-13T00:30:00+08:00', end: '2026-10-13T01:30:00+08:00' };
  const chicago = { start: '2026-10-12T11:30:00-05:00', end: '2026-10-12T12:30:00-05:00' };
  for (const now of ['2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z', '2026-10-12T17:30:00Z']) {
    assert.equal(eventStatus(beijing, instant(now)), eventStatus(chicago, instant(now)));
  }
});

test('fall-back repeated hours use elapsed time, so a later 01:15 does not look earlier than 01:30', () => {
  const repeatedHour = { start: '2026-11-01T01:30:00-05:00', end: '2026-11-01T01:30:00-06:00' };
  assert.equal(eventStatus(repeatedHour, instant('2026-11-01T01:15:00-05:00')), 'upcoming');
  assert.equal(eventStatus(repeatedHour, instant('2026-11-01T01:15:00-06:00')), 'ongoing');
  assert.equal(eventStatus(repeatedHour, instant('2026-11-01T01:30:00-06:00')), 'ended');
  const planned = { timing: 'window', start: '2026-11-01T00:00:00-05:00', end: '2026-11-01T04:00:00-06:00', plannedStart: repeatedHour.start, durationMinutes: 60 };
  assert.equal(eventStatus(planned, instant('2026-11-01T01:15:00-06:00')), 'ongoing');
  assert.equal(eventStatus(planned, instant(repeatedHour.end)), 'ended');
});

test('spring-forward skips a wall-clock hour without ending the event early', () => {
  const spring = { start: '2027-03-14T01:30:00-06:00', end: '2027-03-14T03:30:00-05:00' };
  assert.equal(eventStatus(spring, instant('2027-03-14T03:00:00-05:00')), 'ongoing');
  assert.equal(eventStatus(spring, instant(spring.end)), 'ended');
});
