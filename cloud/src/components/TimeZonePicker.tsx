import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { TIME_ZONES, canonicalTimeZone, deviceTimeZone, isValidTimeZone, zoneLabel } from '../lib/dates';
import type { TimeZone } from '../types';

const OPTIONS = TIME_ZONES.map(value => ({ value, label: zoneLabel(value), search: `${zoneLabel(value)} ${value}`.toLowerCase() }));
const COMMON = ['Asia/Shanghai', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];

export function TimeZonePicker({ label, value, onChange, disabled = false, preferred = [], align = 'start' }: {
  label: string; value: TimeZone; onChange: (zone: TimeZone) => void; disabled?: boolean; preferred?: TimeZone[]; align?: 'start' | 'end';
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term) {
      const matches = OPTIONS.filter(option => option.search.includes(term));
      if (isValidTimeZone(query.trim())) {
        const canonical = canonicalTimeZone(query.trim());
        if (!matches.some(option => option.value === canonical)) matches.unshift({ value: canonical, label: zoneLabel(canonical), search: canonical.toLowerCase() });
      }
      return matches;
    }
    const first = [...new Set([value, ...preferred, deviceTimeZone(), ...COMMON])].filter(isValidTimeZone);
    return [...first.map(zone => ({ value: zone, label: zoneLabel(zone), search: zone.toLowerCase() })), ...OPTIONS.filter(option => !first.includes(option.value))];
  }, [query, value, preferred]);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  function choose(zone: TimeZone) { setOpen(false); setQuery(''); onChange(zone); trigger.current?.focus(); }
  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || [])];
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index < 0 ? event.key === 'ArrowDown' ? 0 : buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  }
  return <div className={`zone-picker align-${align}`} ref={root} onKeyDown={open ? keyDown : undefined}>
    <label htmlFor={id}>{label}</label>
    <button type="button" id={id} ref={trigger} className="zone-picker-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => { setOpen(previous => !previous); setQuery(''); }}>
      <span><strong>{zoneLabel(value)}</strong><small>{value}</small></span><ChevronDown size={14} />
    </button>
    {open ? <div id={`${id}-panel`} className="zone-picker-panel" role="dialog" aria-label={`选择${label}`}>
      <div className="zone-search"><Search size={15} /><input ref={search} aria-label={`搜索${label}`} type="search" placeholder="搜索城市或时区，如 纽约 / Tokyo" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (options[0]) choose(options[0].value); } }} /></div>
      <div role="listbox" aria-label={`${label}选项`} className="zone-options">{options.length ? options.map(option => <button key={option.value} type="button" role="option" aria-selected={canonicalTimeZone(option.value) === canonicalTimeZone(value)} onClick={() => choose(option.value)}><span><strong>{option.label}</strong><small>{option.value}</small></span>{canonicalTimeZone(option.value) === canonicalTimeZone(value) ? <Check size={14} /> : null}</button>) : <p>没有找到时区，试试英文城市名。</p>}</div>
      <p className="zone-picker-note">按日程日期自动换算，包含夏令时调整</p>
    </div> : null}
  </div>;
}
