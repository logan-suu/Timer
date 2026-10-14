import { CalendarDays, CircleAlert, List, ChevronLeft, ChevronRight, HardDrive, Check, LoaderCircle, X } from 'lucide-react';
import { addDays, dateKey, dayParts, startOfDay, startOfWeek } from '../lib/dates';
import { EVENT_TYPES, type EventType, type Navigation, type TimeZone } from '../types';

export function Sidebar({ navigation, onNavigate, selectedDate, onSelectDate, month, onMonthChange, filters, onToggleFilter, conflictsCount,
  saving, error, onBackup, open, onClose, timeZone, cloud = false }: {
  navigation: Navigation; onNavigate: (navigation: Navigation) => void; selectedDate: string; onSelectDate: (date: string) => void;
  month: string; timeZone: TimeZone; onMonthChange: (direction: number) => void; filters: Set<EventType>; onToggleFilter: (type: EventType) => void;
  conflictsCount: number; saving: boolean; error: string; onBackup: () => void; open: boolean; onClose: () => void; cloud?: boolean;
}) {
  const monthParts = dayParts(month);
  const first = `${month.slice(0, 7)}-01`;
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 35 + (addDays(gridStart, 35) <= addDays(first, monthParts.daysInMonth - 1) ? 7 : 0) }, (_, index) => addDays(gridStart, index));
  const today = dateKey(new Date(), timeZone);
  const navItems: { id: Navigation; label: string; icon: typeof CalendarDays }[] = [
    { id: 'calendar', label: '日程总览', icon: CalendarDays }, { id: 'conflicts', label: '冲突检查', icon: CircleAlert }, { id: 'all', label: '全部安排', icon: List },
  ];
  return <>
    {open ? <button className="sidebar-shade" aria-label="关闭导航" onClick={onClose} /> : null}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src="/favicon.svg" alt="" /><div><strong>秋招日程</strong><span>CAREER PLANNER</span></div><button className="icon-button mobile-close" aria-label="关闭导航" onClick={onClose}><X size={20} /></button></div>
      <nav aria-label="主导航">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-button ${id === navigation ? 'active' : ''}`} onClick={() => { onNavigate(id); onClose(); }} aria-current={id === navigation ? 'page' : undefined}>
        <Icon size={20} strokeWidth={1.8} /><span>{label}</span>{id === 'conflicts' && conflictsCount > 0 ? <span className="nav-count">{conflictsCount}</span> : null}
      </button>)}</nav>
      <div className="mini-calendar">
        <div className="mini-calendar-heading"><strong>{monthParts.year}年{monthParts.month}月</strong><div><button className="icon-button small" aria-label="上个月" onClick={() => onMonthChange(-1)}><ChevronLeft size={16} /></button><button className="icon-button small" aria-label="下个月" onClick={() => onMonthChange(1)}><ChevronRight size={16} /></button></div></div>
        <div className="mini-weekdays">{'一二三四五六日'.split('').map(day => <span key={day}>{day}</span>)}</div>
        <div className="mini-days">{days.map(day => <button key={dateKey(day)} className={`${dayParts(day).month !== monthParts.month ? 'outside' : ''} ${dateKey(day) === dateKey(selectedDate) ? 'selected' : ''} ${dateKey(day) === today ? 'is-today' : ''}`} aria-label={`${dayParts(day).year}年${dayParts(day).month}月${dayParts(day).day}日`} aria-pressed={dateKey(day) === dateKey(selectedDate)} onClick={() => { onSelectDate(startOfDay(day)); onClose(); }}>{dayParts(day).day}</button>)}</div>
      </div>
      <div className="type-filters"><div className="sidebar-label">日程类型</div>{(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(([key, value]) => <button key={key} className={`filter-button ${filters.has(key) ? '' : 'filter-off'}`} aria-pressed={filters.has(key)} onClick={() => onToggleFilter(key)}>
        <span className={`color-dot ${value.color}`}>{filters.has(key) ? <Check size={11} strokeWidth={3} /> : null}</span>{value.label}
      </button>)}</div>
      <div className="sidebar-bottom"><div className={`save-status ${error ? 'has-error' : ''}`} role="status">{saving ? <LoaderCircle size={17} className="spin" /> : error ? <CircleAlert size={17} /> : <span className="saved-icon"><Check size={12} strokeWidth={3} /></span>}<span>{saving ? '正在保存…' : error ? '保存需要检查' : cloud ? '云端自动保存' : '本地自动保存'}</span></div>
        <button className="backup-button" onClick={onBackup}><HardDrive size={18} strokeWidth={1.8} />备份管理</button><span className="storage-caption">每次修改，安心留存。</span>
      </div>
    </aside>
  </>;
}
