import { CalendarDays, ChevronRight, CircleAlert, Search, MapPin, Check } from 'lucide-react';
import { useState } from 'react';
import { eventStatus, isPastStatus } from '../../shared/status.mjs';
import type { ConflictPair, ScheduleEvent, TimeZone } from '../types';
import { EVENT_TYPES } from '../types';
import { dateKey, dayLabel, durationLabel, rangeWithZone, zoneLabel } from '../lib/dates';
import { eventLabel, displayStart } from '../lib/events';
import { EventTiming } from './EventTiming';
import { EventStatus } from './EventStatus';

export function Agenda({ events, conflictIds, onEdit, search, onSearch, all, timeZone, comparisonTimeZone, now }: {
  comparisonTimeZone: TimeZone;
  now: number;
  timeZone: TimeZone; events: ScheduleEvent[]; conflictIds: Set<string>; onEdit: (event: ScheduleEvent) => void; search: string; onSearch: (value: string) => void; all: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'past'>('all');
  const matching = events.filter(event => `${event.title} ${event.company} ${event.notes} ${event.location}`.toLowerCase().includes(search.toLowerCase()));
  const pastCount = matching.filter(event => isPastStatus(eventStatus(event, now))).length;
  const filtered = matching.filter(event => statusFilter === 'all' || isPastStatus(eventStatus(event, now)) === (statusFilter === 'past')).sort((a, b) => +new Date(displayStart(a)) - +new Date(displayStart(b)));
  const groups = new Map<string, ScheduleEvent[]>();
  filtered.forEach(event => { const key = dateKey(displayStart(event), timeZone); groups.set(key, [...(groups.get(key) || []), event]); });
  return <section className="agenda-view"><div className="view-heading"><div><h2>{all ? '全部安排' : '本周安排'}</h2><span>{filtered.length} 条日程</span></div><div className="search-field"><Search size={17} /><input aria-label="搜索日程" placeholder="搜索公司或日程" value={search} onChange={event => onSearch(event.target.value)} /></div></div>
    <div className="status-filters" aria-label="按时间状态筛选">{([
      ['all', '全部', matching.length], ['active', '未结束', matching.length - pastCount], ['past', '已结束 / 过期', pastCount],
    ] as const).map(([value, label, count]) => <button key={value} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}<span>{count}</span></button>)}</div>
    {filtered.length ? [...groups.entries()].map(([day, dayEvents]) => <div className="agenda-group" key={day}><h3>{dayLabel(displayStart(dayEvents[0]), true, timeZone)}<span>{dateKey(displayStart(dayEvents[0]), timeZone).slice(0, 4)}</span></h3><div>{dayEvents.map(event => <button key={event.id} className={`agenda-row ${isPastStatus(eventStatus(event, now)) ? 'event-past' : ''}`} onClick={() => onEdit(event)}><span className={`agenda-color ${event.color}`} /><div className="agenda-event-text"><div className="event-title-line"><strong>{eventLabel(event)}</strong><EventStatus event={event} now={now} /></div><EventTiming event={event} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} />{event.location ? <span className="event-location"><MapPin size={12} />{event.location}</span> : null}</div><span className={`type-tag ${event.color}`}>{event.timing === 'window' ? '可选笔试' : EVENT_TYPES[event.type].label}</span>{conflictIds.has(event.id) ? <span className="agenda-conflict"><CircleAlert size={14} />时间冲突</span> : null}<ChevronRight size={17} /></button>)}</div></div>) : <div className="view-empty"><CalendarDays size={35} strokeWidth={1.4} /><h3>{statusFilter !== 'all' && matching.length ? statusFilter === 'past' ? '没有已结束或过期的事项' : '没有未结束的事项' : search ? '没有匹配的日程' : '这段时间还没有安排'}</h3><p>{statusFilter !== 'all' && matching.length ? '可以切换「全部」查看其他事项。' : search ? '试试其他关键词，或打开左侧的日程类型。' : '点击「新建日程」，为下一次笔试或面试留好时间。'}</p></div>}
  </section>;
}

export function ConflictsView({ conflicts, onEdit, onLocate, timeZone, comparisonTimeZone, now }: { now: number; timeZone: TimeZone; comparisonTimeZone: TimeZone; conflicts: ConflictPair[]; onEdit: (event: ScheduleEvent) => void; onLocate: (event: ScheduleEvent) => void; }) {
  return <section className="conflicts-view"><div className="view-heading"><div><h2>冲突检查</h2><span>{conflicts.length ? `${conflicts.length} 组时间重叠，建议提前调整安排` : '所有日程都已检查'}</span></div><span className="check-scope">检查全部日程 · {zoneLabel(timeZone)}</span></div>
    {conflicts.length ? conflicts.map(pair => <article className="conflict-card" key={`${pair.a.id}-${pair.b.id}`}><div className="conflict-card-heading"><span><CircleAlert size={17} />{dayLabel(pair.start, true, timeZone)}</span><strong>重叠 {durationLabel(pair.minutes)}</strong></div><div className="conflict-card-events">{[pair.a, pair.b].map(event => <button key={event.id} className={isPastStatus(eventStatus(event, now)) ? 'event-past' : ''} onClick={() => onEdit(event)}><span className={`agenda-color ${event.color}`} /><div><div className="event-title-line"><strong>{eventLabel(event)}</strong><EventStatus event={event} now={now} /></div><EventTiming event={event} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} showDay /></div><span className="edit-link">调整时间 <ChevronRight size={14} /></span></button>)}</div><div className="conflict-card-footer"><span>重叠时段：{dayLabel(pair.start, false, timeZone)} {rangeWithZone(pair.start, pair.end, timeZone)}</span><button onClick={() => onLocate(pair.a)}>在日历中查看 <ChevronRight size={14} /></button></div></article>) : <div className="view-empty"><div className="empty-success"><Check size={30} /></div><h3>没有固定安排冲突</h3><p>可选笔试仅在安排具体作答时间后参与冲突检查。</p></div>}
  </section>;
}
