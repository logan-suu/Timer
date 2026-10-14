import { occupiedRange } from './domain.mjs';

/** Status follows real instants, independently of the displayed timezone.
 * A planned exam follows its chosen sitting, rather than its wider window.
 * @param {import('./domain.mjs').ScheduleEvent} event
 * @param {number} now
 * @returns {'upcoming' | 'ongoing' | 'ended' | 'available' | 'expired'}
 */
export function eventStatus(event, now) {
  const range = occupiedRange(event);
  if (range) {
    if (now >= +new Date(range.end)) return 'ended';
    return now >= +new Date(range.start) ? 'ongoing' : 'upcoming';
  }
  if (now >= +new Date(event.end)) return 'expired';
  return now >= +new Date(event.start) ? 'available' : 'upcoming';
}

export function isPastStatus(status) {
  return status === 'ended' || status === 'expired';
}
