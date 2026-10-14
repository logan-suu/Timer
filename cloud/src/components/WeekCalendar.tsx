import { useEffect, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { eventStatus, isPastStatus } from '../../shared/status.mjs';
import { layoutSegments } from '../../shared/domain.mjs';
import { addDays, calendarSegments, dateKey, dayParts, dayStart, rangeWithZone, rangeZoneLabel, timeLabel, timeWithZone, alternateTime, zoneLabel, WEEKDAYS } from '../lib/dates';
import { eventLabel, occupiedEvents } from '../lib/events';
import { WindowStrip } from './WindowStrip';
import { EventStatus, STATUS_LABELS } from './EventStatus';
import { EVENT_TYPES, type ScheduleEvent, type TimeZone } from '../types';

interface Segment { event: ScheduleEvent; startMinute: number; endMinute: number; lane: number; lanes: number; }
export function WeekCalendar({ week, selectedDate, onSelectDate, events, conflictIds, onEdit, onCreate, focusId, timeZone, comparisonTimeZone, now }: {
  comparisonTimeZone: TimeZone;
  now: number;
  week: string; selectedDate: string; onSelectDate: (day: string) => void; events: ScheduleEvent[]; conflictIds: Set<string>; timeZone: TimeZone;
  onEdit: (event: ScheduleEvent) => void; onCreate: (date: Date) => void; focusId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const timed = occupiedEvents(events);
  const segments = days.map(day => layoutSegments(calendarSegments(timed, day, timeZone)) as Segment[]);
  const durations = days.map(day => (+dayStart(addDays(day, 1), timeZone) - +dayStart(day, timeZone)) / 60000);
  const hasDstWeek = durations.some(duration => duration !== 1440);
  const all = segments.flat();
  const startHour = Math.min(8, ...all.map(segment => Math.floor(segment.startMinute / 60)));
  const endHour = Math.max(20, ...all.map(segment => Math.ceil(segment.endMinute / 60)));
  const height = (endHour - startHour) * 60;
  const today = dateKey(new Date(now), timeZone);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const focusedEvent = focusId ? timed.find(item => item.id === focusId) : null;
  const scrollSegments = window.matchMedia('(max-width: 760px)').matches ? segments[days.indexOf(selectedDate)] || [] : all;
  const firstMinute = Math.min(...scrollSegments.map(segment => segment.startMinute));
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (focusedEvent) {
      const focusedDay = dateKey(focusedEvent.start, timeZone);
      const minute = focusedDay < week ? startHour * 60 : (+new Date(focusedEvent.start) - +dayStart(focusedDay, timeZone)) / 60000;
      scroll.scrollTo({ top: Math.max(0, minute - startHour * 60 - 150), behavior: 'smooth' });
    } else {
      // Domestic daytime interviews often land overnight in Chicago; show the first event instead of an empty morning.
      scroll.scrollTop = Number.isFinite(firstMinute) ? Math.max(0, firstMinute - startHour * 60 - 70) : 0;
    }
  }, [focusId, focusedEvent?.start, week, timeZone, startHour, endHour, selectedDate, firstMinute]);
  return <div className={`week-calendar ${events.some(event => event.timing === 'window') ? 'has-windows' : ''}`}>
    <WindowStrip events={events} timeZone={timeZone} onEdit={onEdit} now={now} />
    <div className="mobile-day-selector">{days.map((day, index) => <button key={day} className={day === selectedDate ? 'active' : ''} onClick={() => onSelectDate(day)} aria-label={`选择${WEEKDAYS[index]} ${dayParts(day).day}日`}><span>{WEEKDAYS[index].replace('周', '')}</span><strong>{dayParts(day).day}</strong></button>)}</div>
    <div className="calendar-day-heading"><div className="time-heading"><i className="desktop-axis-label">{hasDstWeek ? '经过时间' : zoneLabel(timeZone)}</i><i className="mobile-axis-label">{zoneLabel(timeZone)}</i></div>{days.map((day, index) => <div key={day} className={`day-heading ${day === selectedDate ? 'selected-day' : ''}`}><span>{WEEKDAYS[index]}{durations[index] !== 1440 ? <small className="dst-day-note">时制切换</small> : null}</span><div><strong className={today === day ? 'today-number' : ''}>{dayParts(day).day}</strong><span className="date-month">{dayParts(day).month}月</span></div></div>)}</div>
    <div className="calendar-scroll" ref={scrollRef}>
      <div className="calendar-grid" style={{ height }}>
        <div className="time-axis">{hours.map(hour => {
          const index = days.indexOf(selectedDate);
          const mobileInstant = new Date(+dayStart(selectedDate, timeZone) + hour * 3600000);
          const mobileLabel = timeLabel(mobileInstant, timeZone);
          return <span key={hour} style={{ top: (hour - startHour) * 60 }}><i className="desktop-axis-label">{hasDstWeek ? `+${hour}小时` : <>{String(hour).padStart(2, '0')}:00<small>{zoneLabel(timeZone)}</small></>}</i>{hour * 60 <= durations[index] ? <i className="mobile-axis-label">{hour * 60 === durations[index] ? '24:00' : mobileLabel}<small>{zoneLabel(timeZone)}</small>{rangeZoneLabel(mobileInstant, mobileInstant, timeZone).includes('·') ? <small>{rangeZoneLabel(mobileInstant, mobileInstant, timeZone).split('·')[1]}</small> : null}</i> : null}</span>;
        })}</div>
        {days.map((day, index) => <div key={day} className={`day-column ${index > 4 ? 'weekend' : ''} ${day === selectedDate ? 'selected-day' : ''}`}>
          {hours.slice(0, -1).filter(hour => hour * 60 < durations[index]).map(hour => {
            const instant = new Date(+dayStart(day, timeZone) + hour * 3600000);
            const clock = timeLabel(instant, timeZone);
            return <button key={hour} className="hour-slot" aria-label={`${dayParts(day).month}月${dayParts(day).day}日 ${timeWithZone(instant, timeZone)}新建日程`} style={{ top: (hour - startHour) * 60 }} onClick={() => onCreate(instant)}>{hasDstWeek ? <span className="dst-slot-time">{clock}<small>{rangeZoneLabel(instant, instant, timeZone)}</small></span> : null}</button>;
          })}
          {segments[index].map(segment => {
            const { event, lanes, lane, startMinute, endMinute } = segment;
            const conflict = conflictIds.has(event.id);
            const eventHeight = Math.max(3, endMinute - startMinute - 3);
            const primary = rangeWithZone(event.start, event.end, timeZone);
            const secondary = alternateTime(event.start, event.end, comparisonTimeZone);
            const segmentStart = new Date(+dayStart(day, timeZone) + startMinute * 60000);
            const segmentEnd = new Date(+dayStart(day, timeZone) + endMinute * 60000);
            const status = eventStatus(event, now);
            return <button key={event.id} className={`calendar-event ${event.color} ${isPastStatus(status) ? 'event-past' : ''} ${status === 'ongoing' ? 'event-ongoing' : ''} ${conflict ? 'event-conflict' : ''} ${focusId === event.id ? 'event-focused' : ''} ${eventHeight < 74 ? 'compact-event' : 'has-event-status'}`} style={{ top: startMinute - startHour * 60 + 2, height: eventHeight, left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }} onClick={() => onEdit(events.find(item => item.id === event.id)!)} aria-label={`${eventLabel(event)}，${STATUS_LABELS[status]}${event.timing === 'window' ? '，已安排作答' : ''}，${primary}，${secondary}${conflict ? '，有时间冲突' : ''}`} title={`${eventLabel(event)} · ${STATUS_LABELS[status]}\n${dateKey(event.start, timeZone)} ${primary}\n${secondary}${conflict ? '\n与其他日程有冲突，点击查看' : ''}`}>
              {eventHeight >= 30 ? <span className="event-clock"><span className="event-time">{timeLabel(segmentStart, timeZone)}<span> – {endMinute === durations[index] ? '24:00' : timeLabel(segmentEnd, timeZone)}</span></span><small className="event-zone">（{rangeZoneLabel(segmentStart, segmentEnd, timeZone)}）</small></span> : null}
              {eventHeight >= 14 ? <strong className="event-title">{eventHeight < 74 ? `${STATUS_LABELS[status]} · ` : ''}{eventLabel(event)}</strong> : null}
              {eventHeight >= 110 && lanes === 1 ? <span className="event-secondary-time">{secondary}</span> : null}
              {eventHeight >= 74 ? <EventStatus event={event} now={now} /> : null}
              {eventHeight >= 150 ? <span className="event-type">{EVENT_TYPES[event.type].label}</span> : null}
              {conflict ? <CircleAlert className="conflict-mark" size={14} fill="currentColor" /> : null}
              {dateKey(event.start, timeZone) !== dateKey(event.end, timeZone) ? <span className="overnight-mark">跨天</span> : null}
            </button>;
          })}
          {today === day ? <div className="now-line" style={{ top: (now - +dayStart(day, timeZone)) / 60000 - startHour * 60, display: (now - +dayStart(day, timeZone)) / 60000 >= startHour * 60 && (now - +dayStart(day, timeZone)) / 60000 < endHour * 60 ? undefined : 'none' }}><i /></div> : null}
        </div>)}
      </div>
    </div>
    <div className="calendar-footer"><span><span className="tiny-conflict-dot" />红色描边表示时间冲突</span><span>灰色底表示已结束 · {hasDstWeek ? '时制切换周，以各列时刻为准' : '点击查看两地时间'}</span></div>
  </div>;
}
