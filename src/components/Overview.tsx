import { ArrowRight, CalendarCheck2, ChevronRight, CircleAlert } from 'lucide-react';
import type { ConflictPair, ScheduleEvent, TimeZone } from '../types';
import { dayLabel, rangeWithZone } from '../lib/dates';
import { eventLabel, displayStart, occupiedRange, availableSlots } from '../lib/events';
import { durationLabel, timeWithZone } from '../lib/dates';
import { EventTiming } from './EventTiming';
import { EventStatus } from './EventStatus';

export function Overview({ weekEvents, conflicts, events, onEdit, onConflicts, timeZone, comparisonTimeZone, now }: {
  comparisonTimeZone: TimeZone;
  now: number;
  timeZone: TimeZone; weekEvents: ScheduleEvent[]; conflicts: ConflictPair[]; events: ScheduleEvent[];
  onEdit: (event: ScheduleEvent) => void; onConflicts: () => void;
}) {
  const upcoming = [...events].filter(event => { const range = occupiedRange(event); return range && +new Date(range.end) > now; }).sort((a, b) => +new Date(displayStart(a)) - +new Date(displayStart(b))).slice(0, 3);
  const pending = events.filter(event => event.timing === 'window' && !event.plannedStart && +new Date(event.end) > now).sort((a, b) => +new Date(a.end) - +new Date(b.end));
  const first = conflicts[0];
  return <aside className="overview">
    <h2>本周概览</h2>
    <div className="week-stats"><div><strong>{weekEvents.length}</strong><span>安排</span></div><div><strong className="blue-text">{weekEvents.filter(event => event.type === 'interview').length}</strong><span>面试</span></div><div><strong className={conflicts.length ? 'red-text' : ''}>{conflicts.length}</strong><span>冲突</span></div></div>
    {first ? <div className="conflict-summary"><h3><CircleAlert size={18} />时间有重叠</h3><div className="conflict-pair-labels">{[first.a, first.b].map(event => <button key={event.id} onClick={() => onEdit(event)}><span className={`color-dot ${event.color}`} /><strong>{eventLabel(event)}</strong></button>)}</div><p>{dayLabel(first.start, true, timeZone)}<br /><span>{rangeWithZone(first.start, first.end, timeZone)}</span></p><button className="outline-button full" onClick={onConflicts}>查看冲突 <ArrowRight size={15} /></button>{conflicts.length > 1 ? <span className="more-conflicts">还有 {conflicts.length - 1} 组冲突</span> : null}</div>
      : <div className="no-conflict"><CalendarCheck2 size={20} /><div><strong>已安排时段没有冲突</strong><p>{pending.length ? `还有 ${pending.length} 场笔试需要选择作答时间` : '本周日程没有时间冲突'}</p></div></div>}
    {pending.length ? <div className="pending-section"><h2>待安排笔试 <span>{pending.length}</span></h2>{pending.slice(0, 3).map(event => <button key={event.id} className="pending-exam" onClick={() => onEdit(event)}><span className={`color-dot ${event.color}`} /><div><div className="event-title-line"><strong>{eventLabel(event)}</strong><EventStatus event={event} now={now} /></div><span>需 {durationLabel(event.durationMinutes!)} · 截止 {dayLabel(event.end, false, timeZone)} {timeWithZone(event.end, timeZone)}</span><small>{availableSlots(event, events).length ? '点击选择连续作答时段' : '没有足够的连续空闲时间，请调整安排'}</small></div></button>)}</div> : null}
    <div className="upcoming-section"><h2>接下来</h2>{upcoming.length ? <div className="upcoming-list">{upcoming.map(event => <button className="upcoming-item" key={event.id} onClick={() => onEdit(event)}><span className={`color-dot ${event.color}`} /><div><span>{dayLabel(displayStart(event), true, timeZone)}</span><div className="event-title-line"><strong>{eventLabel(event)}</strong><EventStatus event={event} now={now} /></div><EventTiming event={event} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} /></div><ChevronRight size={17} /></button>)}</div> : <div className="upcoming-empty"><p>暂时没有已确定的日程</p><span>为下一次机会留好时间。</span></div>}</div>
    <div className="overview-footer">从容准备，准时赴约。</div>
  </aside>;
}
