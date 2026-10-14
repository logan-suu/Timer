import { Clock3 } from 'lucide-react';
import { eventStatus, isPastStatus } from '../../shared/status.mjs';
import type { ScheduleEvent, TimeZone } from '../types';
import { dayLabel, timeWithZone, rangeWithZone, durationLabel } from '../lib/dates';
import { eventLabel } from '../lib/events';
import { EventStatus } from './EventStatus';

export function WindowStrip({ events, timeZone, onEdit, now }: { now: number; events: ScheduleEvent[]; timeZone: TimeZone; onEdit: (event: ScheduleEvent) => void }) {
  const windows = events.filter(event => event.timing === 'window').sort((a, b) => +new Date(a.end) - +new Date(b.end));
  if (!windows.length) return null;
  return <section className="window-strip" aria-label="可选笔试窗口"><div className="window-strip-heading"><span><Clock3 size={14} />可选笔试窗口 <b>{windows.length}</b></span><small>选定作答时间后，加入下方日历</small></div><div className="window-cards">{windows.map(event => <button key={event.id} className={`window-card ${event.color} ${isPastStatus(eventStatus(event, now)) ? 'event-past' : ''}`} onClick={() => onEdit(event)}>
    <div className="event-title-line"><strong>{eventLabel(event)}</strong><EventStatus event={event} now={now} /></div>
    <div className="window-details">{event.plannedStart ? '已安排作答' : '尚未安排作答'} · 需 {durationLabel(event.durationMinutes!)}</div>
    <p>{dayLabel(event.start, false, timeZone)} {timeWithZone(event.start, timeZone)} → {dayLabel(event.end, false, timeZone)} {timeWithZone(event.end, timeZone)}</p>
    {event.plannedStart ? <small>作答：{dayLabel(event.plannedStart, false, timeZone)} {rangeWithZone(event.plannedStart, new Date(+new Date(event.plannedStart) + event.durationMinutes! * 60000).toISOString(), timeZone)}</small> : <small>{eventStatus(event, now) === 'expired' ? '窗口已截止 · 点击查看' : '截止前完成 · 点击安排'}</small>}
  </button>)}</div></section>;
}
