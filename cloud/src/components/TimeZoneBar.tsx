import { Globe2 } from 'lucide-react';
import { BEIJING, CHICAGO, dayLabel, timeWithZone, offsetHoursApart } from '../lib/dates';
import type { TimeZone } from '../types';

export function TimeZoneBar({ timeZone, onChange, disabled, now: instant }: { timeZone: TimeZone; onChange: (zone: TimeZone) => void; disabled: boolean; now: number; }) {
  const now = new Date(instant);
  return <div className="time-zone-bar">
    <div className="time-zone-switch"><Globe2 size={15} /><span>日历显示时区</span><div>{[[CHICAGO, '芝加哥'], [BEIJING, '北京']].map(([zone, label]) => <button key={zone} aria-pressed={timeZone === zone} disabled={disabled} onClick={() => onChange(zone as TimeZone)}>{label}</button>)}</div></div>
    <span className="zone-comparison">北京当前快 {offsetHoursApart(now)} 小时 · 自动处理夏令时</span>
    <div className="dual-clock"><span>{dayLabel(now, false, CHICAGO)} {timeWithZone(now, CHICAGO)}</span><span>{dayLabel(now, false, BEIJING)} {timeWithZone(now, BEIJING)}</span></div>
  </div>;
}
