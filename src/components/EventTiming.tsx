import type { ScheduleEvent, TimeZone } from '../types';
import { occupiedRange } from '../lib/events';
import { dayLabel, rangeWithZone, alternateTime, durationLabel, timeWithZone } from '../lib/dates';

export function EventTiming({ event, timeZone, comparisonTimeZone, showDay = false }: { event: ScheduleEvent; timeZone: TimeZone; comparisonTimeZone: TimeZone; showDay?: boolean }) {
  const occupied = occupiedRange(event);
  const range = occupied || event;
  const windowMode = event.timing === 'window';
  return <>
    <span className="event-primary-time">{windowMode ? occupied ? '作答：' : '窗口：' : ''}{showDay || (windowMode && !occupied) ? `${dayLabel(range.start, false, timeZone)} · ` : ''}{rangeWithZone(range.start, range.end, timeZone)}</span>
    <small className="alternate-time">{alternateTime(range.start, range.end, comparisonTimeZone)}</small>
    {windowMode ? <small className="window-meta">需 {durationLabel(event.durationMinutes!)} · {occupied ? '已安排' : '未安排作答'} · 截止 {dayLabel(event.end, false, timeZone)} {timeWithZone(event.end, timeZone)}</small> : null}
  </>;
}
