import { ArrowLeftRight, LocateFixed } from 'lucide-react';
import { canonicalTimeZone, dayLabel, deviceTimeZone, differenceLabel, timeWithZone, zoneLabel } from '../lib/dates';
import { TimeZonePicker } from './TimeZonePicker';
import type { TimeZone } from '../types';

export function TimeZoneBar({ timeZone, comparisonTimeZone, onChange, disabled, now: instant }: { timeZone: TimeZone; comparisonTimeZone: TimeZone; onChange: (zone: TimeZone, comparison: TimeZone) => void; disabled: boolean; now: number; }) {
  const now = new Date(instant);
  const localZone = deviceTimeZone();
  function change(zone: TimeZone, comparison: TimeZone) {
    if (canonicalTimeZone(zone) === canonicalTimeZone(comparison)) onChange(comparisonTimeZone, timeZone);
    else onChange(zone, comparison);
  }
  return <div className="time-zone-bar">
    <div className="world-zone-controls"><TimeZonePicker label="日历显示时区" value={timeZone} onChange={zone => change(zone, comparisonTimeZone)} disabled={disabled} preferred={[comparisonTimeZone]} /><button className="icon-button swap-zones" aria-label="交换日历与对照时区" title="交换日历与对照时区" disabled={disabled} onClick={() => onChange(comparisonTimeZone, timeZone)}><ArrowLeftRight size={16} /></button><TimeZonePicker label="对照时区" value={comparisonTimeZone} onChange={zone => change(timeZone, zone)} disabled={disabled} preferred={[timeZone]} align="end" /><button className="device-zone-button" disabled={disabled || canonicalTimeZone(timeZone) === canonicalTimeZone(localZone)} onClick={() => change(localZone, comparisonTimeZone)} title={`设备时区：${zoneLabel(localZone)}（${localZone}）`}><LocateFixed size={14} />使用设备时区</button></div>
    <div className="dual-clock"><span>{dayLabel(now, false, timeZone)} {timeWithZone(now, timeZone)}</span><span>{dayLabel(now, false, comparisonTimeZone)} {timeWithZone(now, comparisonTimeZone)}</span></div>
    <span className="zone-comparison">{differenceLabel(now, timeZone, comparisonTimeZone)} · 自动处理夏令时</span>
  </div>;
}
