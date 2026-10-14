import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Menu, Plus, RotateCw, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { WeekCalendar } from './components/WeekCalendar';
import { Overview } from './components/Overview';
import { Agenda, ConflictsView } from './components/Agenda';
import { EventEditor } from './components/EventEditor';
import { BackupDialog } from './components/BackupDialog';
import { TimeZoneBar } from './components/TimeZoneBar';
import { useSchedule } from './hooks/useSchedule';
import { useCurrentTime } from './hooks/useCurrentTime';
import { addDays, addMonths, atTime, dateKey, dayLabel, dayParts, dayStart, startOfWeek, browserDefaultSettings, validateSettings, zoneLabel } from './lib/dates';
import { createDemo } from './lib/demo';
import { eventsBetween, findConflicts, displayStart } from './lib/events';
import type { EventType, Navigation, ScheduleEvent, TimeZone } from './types';

const EMPTY_EVENTS: ScheduleEvent[] = [];

export default function App() {
  const [editor, setEditor] = useState<{ event: ScheduleEvent | null; date: Date } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const schedule = useSchedule(!!editor || backupOpen);
  const cloud = schedule.document?.storage === 'cloud';
  const newUserSettings = useMemo(() => browserDefaultSettings(), []);
  const settings = schedule.document && schedule.document.revision > 0 ? validateSettings(schedule.document.settings) : newUserSettings;
  const timeZone = settings.displayTimeZone;
  const inputTimeZone = settings.inputTimeZone;
  const comparisonTimeZone = settings.comparisonTimeZone;
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date(), newUserSettings.displayTimeZone));
  const [month, setMonth] = useState(() => `${selectedDate.slice(0, 7)}-01`);
  const initialized = useRef(false);
  useEffect(() => {
    if (schedule.document && !initialized.current) {
      initialized.current = true;
      const day = dateKey(new Date(), timeZone); setSelectedDate(day); setMonth(`${day.slice(0, 7)}-01`);
    }
  }, [schedule.document, timeZone]);
  const [navigation, setNavigation] = useState<Navigation>('calendar');
  const [view, setView] = useState<'week' | 'list'>('week');
  const [filters, setFilters] = useState(() => new Set<EventType>(['exam', 'interview', 'prep', 'other']));
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const demo = !!schedule.document && !schedule.document.demoDismissed && !schedule.document.events.length;
  const demoEvents = useMemo(() => createDemo(new Date()), []);
  const events = demo ? demoEvents : schedule.document?.events || EMPTY_EVENTS;
  const now = useCurrentTime(events);
  const today = dateKey(new Date(now), timeZone);
  const week = startOfWeek(selectedDate);
  const nextWeek = addDays(week, 7);
  const conflicts = useMemo(() => findConflicts(events), [events]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap(pair => [pair.a.id, pair.b.id])), [conflicts]);
  const weekStartInstant = dayStart(week, timeZone);
  const weekEndInstant = dayStart(nextWeek, timeZone);
  const weekEvents = eventsBetween(events, weekStartInstant, weekEndInstant);
  const weekConflicts = conflicts.filter(pair => +new Date(pair.start) < +weekEndInstant && +new Date(pair.end) > +weekStartInstant);
  const visibleWeekEvents = weekEvents.filter(event => filters.has(event.type));
  const visibleEvents = events.filter(event => filters.has(event.type));
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  function selectDate(date: string) {
    setSelectedDate(date); setMonth(`${date.slice(0, 7)}-01`); setFocusId(null);
  }
  function moveWeek(direction: number) { selectDate(addDays(selectedDate, 7 * direction)); }
  function edit(event: ScheduleEvent) { setEditor({ event, date: new Date(event.start) }); }
  function locate(event: ScheduleEvent) {
    selectDate(dateKey(displayStart(event), timeZone)); setNavigation('calendar'); setView('week');
    setFilters(previous => new Set([...previous, event.type])); setFocusId(event.id);
  }
  async function saveEvent(event: ScheduleEvent) {
    const personalEvents = schedule.document?.events || [];
    const exists = personalEvents.some(item => item.id === event.id);
    await schedule.save(exists ? personalEvents.map(item => item.id === event.id ? event : item) : [...personalEvents, event], true, { ...settings, inputTimeZone: event.timeZone || inputTimeZone });
    setEditor(null); selectDate(dateKey(displayStart(event), timeZone));
    setToast(`日程已${exists ? '更新' : '添加'}，并保存到${cloud ? '云端' : '本地'}`);
  }
  async function deleteEvent(event: ScheduleEvent) {
    await schedule.save((schedule.document?.events || []).filter(item => item.id !== event.id));
    setEditor(null); setToast('日程已删除');
  }
  async function dismissDemo() {
    setActionError('');
    try { await schedule.save([], true, settings); setToast('开始你的秋招规划吧'); }
    catch (cause) { setActionError((cause as Error).message); }
  }
  async function changeTimeZone(zone: TimeZone, comparison: TimeZone) {
    if (!schedule.document || (timeZone === zone && comparisonTimeZone === comparison)) return;
    setActionError('');
    // Follow the selected day's event across midnight and week boundaries when changing zones.
    const anchor = events.find(event => event.id === focusId) || events
      .filter(event => dateKey(displayStart(event), timeZone) === selectedDate)
      .sort((a, b) => +new Date(displayStart(a)) - +new Date(displayStart(b)))[0];
    const nextDate = anchor ? dateKey(displayStart(anchor), zone) : selectedDate === today ? dateKey(new Date(now), zone) : selectedDate;
    try {
      await schedule.save(schedule.document.events, schedule.document.demoDismissed, { ...settings, displayTimeZone: zone, comparisonTimeZone: comparison });
      selectDate(nextDate);
      setToast(`日历已切换为${zoneLabel(zone)}`);
    } catch (cause) { setActionError((cause as Error).message); }
  }
  const selectedParts = dayParts(selectedDate);
  const heading = navigation === 'conflicts' ? '让每一场机会，都不撞期' : navigation === 'all' ? '每一个安排，都清晰可见' : '秋招，每一步都有安排';
  return <div className={`app-shell ${demo ? 'demo-mode' : ''}`}>
    <Sidebar cloud={cloud} navigation={navigation} onNavigate={setNavigation} selectedDate={selectedDate} onSelectDate={date => { selectDate(date); setNavigation('calendar'); }} month={month} timeZone={timeZone} onMonthChange={direction => setMonth(previous => addMonths(previous, direction))} filters={filters} onToggleFilter={type => setFilters(previous => { const next = new Set(previous); if (next.has(type)) next.delete(type); else next.add(type); return next; })} conflictsCount={conflicts.length} saving={schedule.saving} error={schedule.error} onBackup={() => setBackupOpen(true)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <main className="main-area">
      <header className="page-header"><div className="heading-copy"><button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div><h1>{heading}</h1><p>把时间留给准备，把安排交给日历。</p></div></div><button className="primary-button new-event-button" aria-label="新建日程" disabled={!schedule.document || schedule.saving} onClick={() => setEditor({ event: null, date: atTime(selectedDate, 10, 0, inputTimeZone) })}><Plus size={19} /><span>新建日程</span></button></header>
      {demo ? <div className="demo-banner"><span><CalendarDays size={15} />示例预览<span className="demo-explanation"> · 创建第一条日程后，进入你的个人规划</span></span><button disabled={schedule.saving} onClick={() => void dismissDemo()}>开始我的规划 <ChevronRight size={14} /></button></div> : null}
      {schedule.document?.recovered ? <div className="recovery-banner"><CircleAlert size={16} />主数据文件异常，已从上一版备份恢复。请导出备份核对日程。</div> : null}
      {(schedule.error && schedule.document) || actionError ? <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{actionError || schedule.error}</span><button onClick={() => { setActionError(''); void schedule.load(); }} disabled={schedule.saving}><RotateCw size={15} />重新读取</button></div> : null}
      <div className="content-area">
        <div className="schedule-area">
          <div className="calendar-toolbar"><div className="period-controls"><button className="outline-button icon-only" aria-label="上一周" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button><strong>{selectedParts.year}年{selectedParts.month}月</strong><button className="outline-button icon-only" aria-label="下一周" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button><button className="outline-button this-week" onClick={() => selectDate(today)}>本周</button></div><span className="week-range">{dayLabel(week, false)} – {dayLabel(addDays(week, 6), false)}</span><div className="view-switch" aria-label="视图选择"><button className={view === 'week' && navigation === 'calendar' ? 'active' : ''} onClick={() => { setView('week'); setNavigation('calendar'); }} aria-pressed={view === 'week' && navigation === 'calendar'}>周视图</button><button className={view === 'list' && navigation === 'calendar' ? 'active' : ''} onClick={() => { setView('list'); setNavigation('calendar'); }} aria-pressed={view === 'list' && navigation === 'calendar'}>列表</button></div></div>
          <TimeZoneBar now={now} timeZone={timeZone} comparisonTimeZone={comparisonTimeZone} onChange={(zone, comparison) => void changeTimeZone(zone, comparison)} disabled={!schedule.document || schedule.saving} />
          {schedule.loading && !schedule.document ? <div className="view-empty"><RotateCw size={28} className="spin" /><h3>正在读取日程…</h3></div> : !schedule.document ? <div className="view-empty" role="alert"><CircleAlert size={30} /><h3>暂时无法读取日程</h3><p>{schedule.error}</p><button className="primary-button" onClick={() => void schedule.load()}>重新读取</button></div> : navigation === 'conflicts' ? <ConflictsView now={now} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} conflicts={conflicts} onEdit={edit} onLocate={locate} /> : navigation === 'all' || view === 'list' ? <Agenda now={now} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} events={navigation === 'all' ? visibleEvents : visibleWeekEvents} conflictIds={conflictIds} onEdit={edit} search={search} onSearch={setSearch} all={navigation === 'all'} /> : <WeekCalendar now={now} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} week={week} selectedDate={selectedDate} onSelectDate={setSelectedDate} events={visibleWeekEvents} conflictIds={conflictIds} onEdit={edit} onCreate={date => setEditor({ event: null, date })} focusId={focusId} />}
        </div>
        <Overview now={now} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} weekEvents={weekEvents} conflicts={weekConflicts} events={events} onEdit={edit} onConflicts={() => setNavigation('conflicts')} />
      </div>
    </main>
    {editor ? <EventEditor key={editor.event?.id || editor.date.toISOString()} event={editor.event} date={editor.date} comparisonTimeZone={comparisonTimeZone} timeZone={timeZone} inputTimeZone={inputTimeZone} events={events} demo={demo} saving={schedule.saving} onSave={saveEvent} onDelete={deleteEvent} onClose={() => setEditor(null)} /> : null}
    {backupOpen && schedule.document ? <BackupDialog timeZone={timeZone} document={schedule.document} saving={schedule.saving} onImport={async (imported, importedSettings) => { await schedule.save(imported, true, importedSettings || settings); setToast('备份已导入并保存'); if (imported[0]) selectDate(dateKey(imported[0].start, importedSettings?.displayTimeZone || timeZone)); }} onClose={() => setBackupOpen(false)} /> : null}
    {toast ? <div className="toast" role="status"><span><Check size={15} /></span>{toast}<button className="icon-button" aria-label="关闭提示" onClick={() => setToast('')}><X size={16} /></button></div> : null}
  </div>;
}
