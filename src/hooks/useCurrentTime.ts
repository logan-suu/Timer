import { useEffect, useState } from 'react';
import { occupiedRange } from '../lib/events';
import type { ScheduleEvent } from '../types';

/** One clock for every view; refresh exactly at event boundaries and on return. */
export function useCurrentTime(events: ScheduleEvent[]) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: number;
    const boundaries = events.flatMap(event => {
      const range = occupiedRange(event) || event;
      return [+new Date(range.start), +new Date(range.end)];
    }).sort((a, b) => a - b);
    function refresh() {
      window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const next = boundaries.find(instant => instant > current);
      timer = window.setTimeout(refresh, next === undefined ? 60000 : Math.min(60000, next - current));
    }
    function onVisible() { if (document.visibilityState === 'visible') refresh(); }
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [events]);
  return now;
}
