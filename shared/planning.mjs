/** Choose a 15-minute start inside a continuous gap, leaving enough real time to finish.
 * @param {{start:string,end:string}} slot
 * @param {number} desiredInstant
 * @param {number} durationMinutes
 * @returns {string | null}
 */
export function selectSlotStart(slot, desiredInstant, durationMinutes) {
  const first = +new Date(slot.start);
  const last = +new Date(slot.end) - durationMinutes * 60000;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !Number.isFinite(desiredInstant) ||
      !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440 || last < first) return null;
  const rounded = Math.round(desiredInstant / 900000) * 900000;
  return new Date(Math.min(last, Math.max(first, rounded))).toISOString();
}
