import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Clock3, CircleAlert } from 'lucide-react';
import { layoutSegments } from '../../shared/domain.mjs';
import { selectSlotStart } from '../../shared/planning.mjs';
import { addDays, calendarSegments, canonicalTimeZone, dateKey, dayLabel, dayStart, durationLabel, rangeWithZone, rangeZoneLabel, timeLabel, zoneLabel } from '../lib/dates';
import { TimeZonePicker } from './TimeZonePicker';
import { availableSlots, eventLabel, occupiedEvents } from '../lib/events';
import type { ScheduleEvent, TimeZone } from '../types';

interface Slot { start: string; end: string; minutes: number; }
interface Segment { event: ScheduleEvent; startMinute: number; endMinute: number; lane: number; lanes: number; }

export function WindowPlanner({ exam, events, plannedStart, disabled, onSelect, defaultTimeZone, comparisonTimeZone }: {
  defaultTimeZone: TimeZone; comparisonTimeZone: TimeZone;
  exam: ScheduleEvent; events: ScheduleEvent[]; plannedStart: string | null; disabled: boolean;
  onSelect: (instant: string) => void;
}) {
  const dayId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timeZone, setTimeZone] = useState<TimeZone>(defaultTimeZone);
  const alternateZone = canonicalTimeZone(timeZone) === canonicalTimeZone(defaultTimeZone) ? comparisonTimeZone : defaultTimeZone;
  const slots = availableSlots(exam, events);
  const firstDay = dateKey(exam.start, timeZone);
  const lastDay = dateKey(new Date(+new Date(exam.end) - 1), timeZone);
  const days: string[] = [];
  for (let day = firstDay; day <= lastDay && days.length < 33; day = addDays(day, 1)) days.push(day);
  const focusDay = dateKey(plannedStart || slots[0]?.start || exam.start, timeZone);
  const [chosenDay, setChosenDay] = useState(focusDay);
  const day = days.includes(chosenDay) ? chosenDay : days.includes(focusDay) ? focusDay : firstDay;
  const dayIndex = days.indexOf(day);
  const startOfDay = +dayStart(day, timeZone);
  const endOfDay = +dayStart(addDays(day, 1), timeZone);
  const dayMinutes = (endOfDay - startOfDay) / 60000;
  const scale = dayMinutes === 1440 ? .6 : .8;
  const others = events.filter(event => event.id !== exam.id);
  const segments = layoutSegments(calendarSegments(occupiedEvents(others), day, timeZone)) as Segment[];
  const opening = Math.max(startOfDay, +new Date(exam.start));
  const closing = Math.min(endOfDay, +new Date(exam.end));
  const startMinute = Math.max(0, Math.floor((opening - startOfDay) / 3600000) * 60 - 60);
  const endMinute = Math.min(dayMinutes, Math.ceil((closing - startOfDay) / 3600000) * 60 + 60);
  const height = (endMinute - startMinute) * scale + 32;
  const ticks = Array.from({ length: Math.floor((endMinute - startMinute) / 60) + 1 }, (_, index) => startMinute + index * 60);
  const planEnd = plannedStart ? new Date(+new Date(plannedStart) + exam.durationMinutes! * 60000).toISOString() : null;
  const planned = plannedStart && planEnd ? calendarSegments([{ ...exam, start: plannedStart, end: planEnd }], day, timeZone)[0] : null;
  const conflicts = plannedStart && planEnd ? occupiedEvents(others).filter(item => +new Date(item.start) < +new Date(planEnd) && +new Date(item.end) > +new Date(plannedStart)) : [];
  const outsideWindow = !!plannedStart && (+new Date(plannedStart) < +new Date(exam.start) || +new Date(planEnd!) > +new Date(exam.end));
  const daySlots = slots.filter(slot => +new Date(slot.start) < endOfDay && +new Date(slot.end) > startOfDay);
  const pending = others.filter(item => item.timing === 'window' && !item.plannedStart && +new Date(item.start) < endOfDay && +new Date(item.end) > startOfDay);
  const nowMinute = (Date.now() - startOfDay) / 60000;
  const position = (minute: number) => (minute - startMinute) * scale + 16;
  const clip = (first: number, last: number) => ({ top: position(Math.max(startMinute, first)), height: Math.max(0, Math.min(endMinute, last) - Math.max(startMinute, first)) * scale });

  useEffect(() => { setChosenDay(focusDay); }, [focusDay, timeZone]);
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const target = plannedStart && dateKey(plannedStart, timeZone) === day ? (+new Date(plannedStart) - startOfDay) / 60000 : (opening - startOfDay) / 60000;
    if (position(target) < scroll.scrollTop || position(target) > scroll.scrollTop + scroll.clientHeight - 60) scroll.scrollTop = Math.max(0, position(target) - 40);
  }, [day, startMinute, plannedStart, timeZone, startOfDay, opening]);

  function choose(event: MouseEvent<HTMLButtonElement>, slot: Slot) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const visibleStart = Math.max(startOfDay, +new Date(slot.start));
    const visibleEnd = Math.min(endOfDay, +new Date(slot.end));
    const desired = event.detail === 0 ? visibleStart : visibleStart + Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * (visibleEnd - visibleStart);
    // A gap can extend past midnight: the exam may continue on the next local day.
    const localSlot = { ...slot, start: new Date(visibleStart).toISOString() };
    const instant = selectSlotStart(localSlot, desired, exam.durationMinutes!);
    if (instant) onSelect(instant);
  }
  function changeTimeZone(zone: TimeZone) {
    setTimeZone(zone);
    setChosenDay(dateKey(plannedStart || slots[0]?.start || exam.start, zone));
  }

  return <section className="window-planner" aria-label="安排笔试时间轴">
    <div className="planner-heading"><div><strong><Clock3 size={16} />对照日程安排</strong><p>右侧空闲处点选开始，预留完整的 {durationLabel(exam.durationMinutes!)}。</p></div><span>{zoneLabel(timeZone)}</span></div>
    <div className="planner-zone-switch"><TimeZonePicker label="时间轴显示时区" value={timeZone} onChange={changeTimeZone} disabled={disabled} preferred={[defaultTimeZone, comparisonTimeZone]} /></div>
    <div className="planner-date-nav">
      <button type="button" aria-label="时间轴前一天" disabled={disabled || dayIndex === 0} onClick={() => setChosenDay(days[dayIndex - 1])}><ChevronLeft size={16} /></button>
      <label htmlFor={dayId} className="visually-hidden">时间轴日期</label>
      <select id={dayId} value={day} disabled={disabled} onChange={event => setChosenDay(event.target.value)}>{days.map(value => <option key={value} value={value}>{dayLabel(value)}（{zoneLabel(timeZone)}）</option>)}</select>
      <button type="button" aria-label="时间轴后一天" disabled={disabled || dayIndex === days.length - 1} onClick={() => setChosenDay(days[dayIndex + 1])}><ChevronRight size={16} /></button>
    </div>
    <div className="planner-legend"><span><i className="legend-occupied" />已有安排</span><span><i className="legend-free" />足够作答的空档</span><span><i className="legend-preview" />本场预览</span></div>
    <div className="planner-columns"><span>时间</span><span>已有安排</span><span>本场笔试 · 可选窗口</span></div>
    <div className="planner-scroll" ref={scrollRef}>
      <div className="planner-grid" style={{ height }}>
        <div className="planner-axis">{ticks.map(minute => {
          const instant = new Date(startOfDay + minute * 60000);
          const label = rangeZoneLabel(instant, instant, timeZone);
          return <div key={minute} style={{ top: position(minute) }}><b>{minute === dayMinutes ? '24:00' : timeLabel(instant, timeZone)}</b><small>{zoneLabel(timeZone)}</small>{label.includes('·') ? <small>{label.split('·')[1]}</small> : null}</div>;
        })}</div>
        <div className="planner-track planner-existing">
          {ticks.map(minute => <i className="planner-hour-line" key={minute} style={{ top: position(minute) }} />)}
          {segments.filter(segment => segment.endMinute > startMinute && segment.startMinute < endMinute).map(segment => <div key={segment.event.id} className={`planner-event ${segment.event.color}`} style={{ ...clip(segment.startMinute, segment.endMinute), left: `calc(${segment.lane / segment.lanes * 100}% + 3px)`, width: `calc(${100 / segment.lanes}% - 6px)` }} title={`${eventLabel(segment.event)}\n${dayLabel(segment.event.start, false, timeZone)} ${rangeWithZone(segment.event.start, segment.event.end, timeZone)}\n${dayLabel(segment.event.start, false, alternateZone)} ${rangeWithZone(segment.event.start, segment.event.end, alternateZone)}`}><strong>{eventLabel(segment.event)}</strong>{segment.endMinute - segment.startMinute >= 60 ? <><span>{timeLabel(segment.event.start, timeZone)} – {timeLabel(segment.event.end, timeZone)}</span><small>（{rangeZoneLabel(segment.event.start, segment.event.end, timeZone)}）</small></> : null}</div>)}
        </div>
        <div className="planner-track planner-current">
          <div className="planner-window" style={clip((opening - startOfDay) / 60000, (closing - startOfDay) / 60000)} />
          {ticks.map(minute => <i className="planner-hour-line" key={minute} style={{ top: position(minute) }} />)}
          {daySlots.map(slot => {
            const first = Math.max(startOfDay, +new Date(slot.start));
            const last = Math.min(endOfDay, +new Date(slot.end));
            const canStart = last > first && +new Date(slot.end) - first >= exam.durationMinutes! * 60000;
            return <button key={slot.start} type="button" className="planner-free-slot" disabled={disabled || !canStart} style={clip((first - startOfDay) / 60000, (last - startOfDay) / 60000)} aria-label={`选择空闲时段 ${dayLabel(new Date(first), false, timeZone)} ${rangeWithZone(new Date(first).toISOString(), new Date(last).toISOString(), timeZone)}开始作答`} onClick={event => choose(event, slot)}>{last - first >= 3600000 ? <span>{canStart ? '点击安排' : '可接上前一天作答'}</span> : null}</button>;
          })}
          {planned ? <div className={`planner-draft ${conflicts.length || outsideWindow ? 'planner-draft-conflict' : ''}`} style={clip(planned.startMinute, planned.endMinute)}><strong>本场作答预览</strong><span>{timeLabel(plannedStart!, timeZone)} – {timeLabel(planEnd!, timeZone)}</span><small>（{rangeZoneLabel(plannedStart!, planEnd!, timeZone)}）</small></div> : null}
        </div>
        {nowMinute >= startMinute && nowMinute < endMinute ? <div className="planner-now" style={{ top: position(nowMinute) }}><span>现在</span></div> : null}
      </div>
    </div>
    <div className={`planner-selection ${conflicts.length || outsideWindow ? 'planner-selection-conflict' : ''}`} aria-live="polite">{plannedStart && planEnd ? <>
      <strong>{conflicts.length || outsideWindow ? <><CircleAlert size={14} />{outsideWindow ? '作答超出窗口，请调整' : `与 ${conflicts.length} 条日程重叠`}</> : '已选作答时间 · 保存后生效'}</strong>
      <span>{dayLabel(plannedStart, false, timeZone)} {rangeWithZone(plannedStart, planEnd, timeZone)}</span>
      <small>{dayLabel(plannedStart, false, alternateZone)} {rangeWithZone(plannedStart, planEnd, alternateZone)}</small>
      <div className="planner-adjust"><button type="button" disabled={disabled || +new Date(plannedStart) - 900000 < +new Date(exam.start)} onClick={() => onSelect(new Date(+new Date(plannedStart) - 900000).toISOString())}>提前 15 分钟</button><button type="button" disabled={disabled || +new Date(planEnd) + 900000 > +new Date(exam.end)} onClick={() => onSelect(new Date(+new Date(plannedStart) + 900000).toISOString())}>推后 15 分钟</button></div>
    </> : <span>{daySlots.length ? '绿色空档可容纳整场笔试。点击预览，也可手动填写开始时间。' : '当天没有足够的连续空档，可切换日期查看。'}</span>}</div>
    <div className="planner-day-agenda"><strong>当天已有安排</strong>{segments.length ? segments.map(({ event }) => <div key={event.id}><b><i className={`color-dot ${event.color}`} />{eventLabel(event)}</b><span>{dayLabel(event.start, false, timeZone)} {rangeWithZone(event.start, event.end, timeZone)}</span></div>) : <p>当天没有已确定的安排。</p>}{pending.length ? <p>还有 {pending.length} 场笔试待安排：{pending.map(eventLabel).join('、')}。未选作答时间前不占用日历。</p> : null}</div>
  </section>;
}
