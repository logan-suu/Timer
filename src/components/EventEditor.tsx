import { useId, useState } from 'react';
import { CalendarDays, CircleAlert, ArrowLeftRight, ExternalLink, Trash2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { WindowPlanner } from './WindowPlanner';
import { COLORS, COLOR_LABELS, EVENT_TYPES, type EventColor, type EventType, type ScheduleEvent, type TimeZone } from '../types';
import { localInput, dayLabel, rangeWithZone, possibleInstants, fromZonedInput, BEIJING, CHICAGO, zoneLabel, chicagoRangeInfo, durationLabel, otherZone, rangeZoneLabel } from '../lib/dates';
import { eventLabel, findConflicts, validateEvents, occupiedRange, availableSlots, inferExamTiming } from '../lib/events';
import { createEventId } from '../lib/ids';

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240];

export function EventEditor({ event, date, events, demo, saving, timeZone, inputTimeZone, onSave, onDelete, onClose }: {
  event: ScheduleEvent | null; date: Date; timeZone: TimeZone; inputTimeZone: TimeZone; events: ScheduleEvent[]; demo: boolean; saving: boolean;
  onSave: (event: ScheduleEvent) => Promise<void>; onDelete: (event: ScheduleEvent) => Promise<void>; onClose: () => void;
}) {
  const prefix = useId();
  const initial = event || { title: '', company: '', type: 'exam' as EventType, color: 'purple' as EventColor, start: date.toISOString(), end: new Date(+date + 3600000).toISOString(), location: '', link: '', notes: '' };
  const initialZone = event?.timeZone || (event ? timeZone : inputTimeZone);
  const [editorZone, setEditorZone] = useState<TimeZone>(initialZone);
  function choices(value: string, zone: TimeZone) { try { return possibleInstants(value, zone); } catch { return []; } }
  function occurrenceFor(value: string, zone: TimeZone) {
    const candidates = choices(localInput(value, zone), zone);
    return candidates.length > 1 ? (candidates[1].iso === new Date(value).toISOString() ? 'later' : 'earlier') : '';
  }
  const [startOccurrence, setStartOccurrence] = useState(() => occurrenceFor(initial.start, initialZone));
  const [endOccurrence, setEndOccurrence] = useState(() => occurrenceFor(initial.end, initialZone));
  const [title, setTitle] = useState(initial.title);
  const [company, setCompany] = useState(initial.company);
  const [type, setType] = useState(initial.type);
  const [duration, setDuration] = useState(event?.durationMinutes ? String(event.durationMinutes) : '');
  const [durationOption, setDurationOption] = useState(() => event?.durationMinutes ? DURATION_OPTIONS.includes(event.durationMinutes) ? String(event.durationMinutes) : 'custom' : '');
  const [planEnabled, setPlanEnabled] = useState(!!event?.plannedStart);
  const [planned, setPlanned] = useState(event?.plannedStart ? localInput(event.plannedStart, initialZone) : '');
  const [plannedOccurrence, setPlannedOccurrence] = useState(event?.plannedStart ? occurrenceFor(event.plannedStart, initialZone) : '');
  const [color, setColor] = useState(initial.color);
  const [start, setStart] = useState(localInput(initial.start, initialZone));
  const [end, setEnd] = useState(localInput(initial.end, initialZone));
  const [location, setLocation] = useState(initial.location);
  const [link, setLink] = useState(initial.link);
  const [notes, setNotes] = useState(demo ? '' : initial.notes);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const startChoices = choices(start, editorZone);
  const endChoices = choices(end, editorZone);
  function resolve(value: string, occurrence: string) { try { return fromZonedInput(value, editorZone, occurrence); } catch { return null; } }
  const startInstant = resolve(start, startOccurrence);
  const endInstant = resolve(end, endOccurrence);
  const plannedInstant = resolve(planned, plannedOccurrence);
  const plannedChoices = choices(planned, editorZone);
  const minutes = Number(duration);
  const validRange = startInstant && endInstant && +endInstant > +startInstant;
  const legacyFixed = !!event && event.type === 'exam' && event.durationMinutes == null && event.timing !== 'window';
  const inferredTiming = type === 'exam' && durationOption && validRange ? inferExamTiming(startInstant, endInstant, minutes) : null;
  const windowMode = type === 'exam' && inferredTiming === 'window';
  const spanMinutes = validRange ? (+endInstant - +startInstant) / 60000 : null;
  const durationError = type === 'exam' && durationOption && validRange && Number.isInteger(minutes) && minutes >= 1 && minutes * 60000 > +endInstant - +startInstant ? '时间段短于笔试时长，请调整开始或结束时间。' : '';
  const validDuration = type !== 'exam' || (legacyFixed && !durationOption) || !!inferredTiming;
  const validPlan = !windowMode || !planEnabled || (plannedInstant && validRange && +plannedInstant >= +startInstant && +plannedInstant + minutes * 60000 <= +endInstant);
  const base: ScheduleEvent | null = validRange && validDuration ? { id: event?.id || 'new-candidate', title: title || '新日程', company, type, color, timeZone: editorZone, start: startInstant.toISOString(), end: endInstant.toISOString(), location, link, notes,
    timing: windowMode ? 'window' : 'fixed', ...(type === 'exam' && durationOption ? { durationMinutes: minutes } : {}) } : null;
  const candidate = base && validPlan ? { ...base, ...(windowMode && planEnabled && plannedInstant ? { plannedStart: plannedInstant.toISOString() } : {}) } : null;
  const preview = candidate || base;
  const occupied = candidate ? occupiedRange(candidate) : null;
  const clockInfo = preview ? chicagoRangeInfo(occupied?.start || preview.start, occupied?.end || preview.end) : null;
  const slots = base && windowMode ? availableSlots(base, events) : [];
  function selectPlanned(instant: string) {
    setPlanEnabled(true); setPlanned(localInput(instant, editorZone));
    setPlannedOccurrence(occurrenceFor(instant, editorZone)); setError('');
  }
  function changeEditorZone(zone: TimeZone) {
    if (startInstant) { setStart(localInput(startInstant, zone)); setStartOccurrence(occurrenceFor(startInstant.toISOString(), zone)); }
    else setStartOccurrence('');
    if (endInstant) { setEnd(localInput(endInstant, zone)); setEndOccurrence(occurrenceFor(endInstant.toISOString(), zone)); }
    else setEndOccurrence('');
    if (plannedInstant) { setPlanned(localInput(plannedInstant, zone)); setPlannedOccurrence(occurrenceFor(plannedInstant.toISOString(), zone)); }
    else setPlannedOccurrence('');
    setEditorZone(zone); setError('');
  }
  function changeStart(value: string) {
    const next = choices(value, editorZone);
    if (type !== 'exam' && startInstant && endInstant && +endInstant > +startInstant && next.length === 1) {
      const newEnd = new Date(+new Date(next[0].iso) + (+endInstant - +startInstant));
      setEnd(localInput(newEnd, editorZone)); setEndOccurrence(occurrenceFor(newEnd.toISOString(), editorZone));
    }
    setStart(value); setStartOccurrence(''); setError('');
  }
  const overlaps = candidate ? findConflicts([...events.filter(item => item.id !== event?.id), candidate]).filter(pair => pair.a.id === candidate.id || pair.b.id === candidate.id) : [];
  async function submit(submission: React.FormEvent) {
    submission.preventDefault(); setError('');
    if (!candidate) {
      setError(!startChoices.length || !endChoices.length ? '输入时间无效，或该当地时间因夏令时切换而不存在。' : (!startInstant || !endInstant) ? '夏令时结束时这个时间出现两次，请先选择具体时段。' : !validRange ? '结束时间必须晚于开始时间。' : !Number.isInteger(minutes) || minutes < 1 || minutes > 1440 ? '请选择笔试时长，范围为 1 至 1440 分钟。' : minutes * 60000 > +endInstant - +startInstant ? '时间段短于笔试时长，请调整开始或结束时间。' : planEnabled && !plannedInstant ? '请选择有效的计划作答时间；重复的当地时间需要选择第一次或第二次。' : '计划作答须在可选窗口内开始，并在截止前完成。'); return;
    }
    try {
      const value = validateEvents([{ ...candidate, title, id: event && !demo ? event.id : createEventId() }])[0];
      await onSave(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
  }
  return <Dialog title={event ? (demo ? '从示例创建日程' : '编辑日程') : '新建日程'} subtitle="每一场机会，都值得认真安排。" onClose={onClose} busy={saving} wide className={windowMode ? 'dialog-planning' : ''}>
    <form className={`event-form ${windowMode ? 'planning-form' : ''}`} onSubmit={submit}>
      <div className="planning-layout">
      <fieldset disabled={saving}>
        <div className="form-row"><label htmlFor={`${prefix}-company`}>公司<input id={`${prefix}-company`} placeholder="例如：字节跳动" value={company} maxLength={100} onChange={event => setCompany(event.target.value)} /></label><label htmlFor={`${prefix}-title`}>日程名称 <span className="required">*</span><input data-autofocus id={`${prefix}-title`} placeholder="例如：技术一面" value={title} required maxLength={120} onChange={event => setTitle(event.target.value)} /></label></div>
        <div className="form-section"><span className="form-label">日程类型</span><div className="type-options">{(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(([key, value]) => <button type="button" key={key} className={type === key ? 'selected' : ''} aria-pressed={type === key} onClick={() => { setType(key); setColor(value.color); setError(''); }}><span className={`color-dot ${value.color}`} />{value.label}</button>)}</div></div>
        <div className="input-time-zone"><label htmlFor={`${prefix}-zone`}>通知 / 录入时区<select id={`${prefix}-zone`} value={editorZone} onChange={event => changeEditorZone(event.target.value as TimeZone)}><option value={BEIJING}>北京时间（中国国内）</option><option value={CHICAGO}>芝加哥时间（你所在地）</option></select></label><span>切换时区会换算已填写的时间</span></div>
        <div className="form-row"><label htmlFor={`${prefix}-start`}>{windowMode ? '窗口开放时间' : '开始时间'} <span className="required">*</span><input id={`${prefix}-start`} type="datetime-local" required value={start} min="2000-01-01T00:00" max="2100-12-31T23:59" onChange={event => changeStart(event.target.value)} /><small className="field-zone">（{startInstant ? rangeZoneLabel(startInstant, startInstant, editorZone) : zoneLabel(editorZone)}）</small></label><label htmlFor={`${prefix}-end`}>{windowMode ? '完成截止时间' : '结束时间'} <span className="required">*</span><input id={`${prefix}-end`} type="datetime-local" required value={end} min="2000-01-01T00:00" max="2100-12-31T23:59" onChange={event => { setEnd(event.target.value); setEndOccurrence(''); setError(''); }} /><small className="field-zone">（{endInstant ? rangeZoneLabel(endInstant, endInstant, editorZone) : zoneLabel(editorZone)}）</small></label></div>
        {type === 'exam' ? <div className="exam-duration-fields">
          <div className={`duration-controls ${durationOption === 'custom' ? 'form-row' : ''}`}>
            <div className="duration-control">
              <label htmlFor={`${prefix}-duration-option`}>笔试时长{!legacyFixed ? <span className="required">*</span> : null}</label>
              <select id={`${prefix}-duration-option`} required={!legacyFixed} value={durationOption} onChange={event => { const value = event.target.value; setDurationOption(value); if (value !== 'custom') setDuration(value); setError(''); }}>
                <option value="">请选择实际作答用时</option>
                {DURATION_OPTIONS.map(value => <option key={value} value={String(value)}>{value} 分钟{value >= 60 ? `（${durationLabel(value)}）` : ''}</option>)}
                <option value="custom">自定义时长</option>
              </select>
            </div>
            {durationOption === 'custom' ? <label htmlFor={`${prefix}-duration`}>自定义时长（分钟） <span className="required">*</span><input id={`${prefix}-duration`} type="number" min="1" max="1440" step="1" required placeholder="例如：100" value={duration} onChange={event => { setDuration(event.target.value); setError(''); }} /></label> : null}
          </div>
          <div className={`automatic-timing ${windowMode ? 'is-window' : ''}`} aria-live="polite">{inferredTiming ? <><strong>自动识别：{windowMode ? '窗口内任选' : '固定开考'}</strong><span>时间段共 {durationLabel(spanMinutes!)}，笔试需 {durationLabel(minutes)}。{windowMode ? '选定作答时间后，仅实际作答时段计入冲突。' : '两者相等，按开始至结束时间占用日历。'}</span></> : <span>{!durationOption && legacyFixed ? '尚未填写笔试时长，保留当前固定安排；补充时长后自动识别。' : '时间段长于笔试时长时，自动识别为窗口内任选；相等时为固定开考。'}</span>}</div>
          {durationError ? <div className="form-error" role="alert"><CircleAlert size={16} />{durationError}</div> : null}
        </div> : null}
      </fieldset>
      {base && windowMode ? <div className="planning-timeline-host"><WindowPlanner exam={base} events={events} plannedStart={planEnabled && plannedInstant ? plannedInstant.toISOString() : null} disabled={saving} onSelect={selectPlanned} /></div> : null}
      <fieldset disabled={saving} className="event-details-fieldset">
        {windowMode ? <div className="window-plan-fields"><label className="plan-toggle"><input type="checkbox" checked={planEnabled} onChange={event => setPlanEnabled(event.target.checked)} />安排具体作答时间</label>{planEnabled ? <><label htmlFor={`${prefix}-planned`}>计划开始时间<input id={`${prefix}-planned`} type="datetime-local" required value={planned} onChange={event => { setPlanned(event.target.value); setPlannedOccurrence(''); }} /><small className="field-zone">（{plannedInstant ? rangeZoneLabel(plannedInstant, plannedInstant, editorZone) : zoneLabel(editorZone)}）</small></label>{plannedChoices.length > 1 ? <label className="dst-choice">计划开始时间出现两次，请选择<select aria-label="计划开始时间重复时段" value={plannedOccurrence} onChange={event => setPlannedOccurrence(event.target.value)}><option value="">请选择具体时段</option><option value="earlier">第一次（UTC{plannedChoices[0].offset}，夏令时）</option><option value="later">第二次（UTC{plannedChoices[1].offset}，标准时间）</option></select></label> : null}</> : <p>尚未安排具体时间时，窗口显示在日历上方，整段窗口不计入时间冲突。</p>}</div> : null}
        {[[startChoices, startOccurrence, setStartOccurrence, '开始'], [endChoices, endOccurrence, setEndOccurrence, '结束']].map(([candidates, occurrence, setter, label], index) => {
          const values = candidates as { iso: string; offset: string }[];
          return values.length > 1 ? <label key={index} className="dst-choice">{label as string}时间出现两次，请选择<select aria-label={`${label}时间重复时段`} value={occurrence as string} onChange={event => (setter as (value: string) => void)(event.target.value)}><option value="">请选择具体时段</option><option value="earlier">第一次（UTC{values[0].offset}，夏令时）</option><option value="later">第二次（UTC{values[1].offset}，标准时间）</option></select></label> : null;
        })}
        {(start && !startChoices.length) || (end && !endChoices.length) ? <div className="form-error timezone-error" role="alert"><CircleAlert size={16} />输入的当地时间无效，或处于夏令时跳过的时段，请调整时间。</div> : null}
        {preview && clockInfo ? <div className="conversion-panel">
          {windowMode ? <span className="form-label">可选窗口 · 需 {durationLabel(minutes)}</span> : null}
          <div className="conversion-preview" aria-label="两地时间换算"><div className={editorZone === BEIJING ? 'source-zone' : ''}><span>北京时间</span><strong>{dayLabel(preview.start, true, BEIJING)}</strong><b>{rangeWithZone(preview.start, preview.end, BEIJING)}</b></div><ArrowLeftRight size={17} /><div className={editorZone === CHICAGO ? 'source-zone' : ''}><span>芝加哥时间</span><strong>{dayLabel(preview.start, true, CHICAGO)}</strong><b>{rangeWithZone(preview.start, preview.end, CHICAGO)}</b></div></div>
          <p className={`event-time-rule ${clockInfo.crossesTransition ? 'crosses-transition' : ''}`} aria-label="日程当天时差">{clockInfo.crossesTransition ? <>{windowMode && !occupied ? '窗口' : '本场'}跨越时制切换：{clockInfo.start.label} → {clockInfo.end.label}，北京快 {clockInfo.start.differenceHours} → {clockInfo.end.differenceHours} 小时；{windowMode && !occupied ? `作答需 ${durationLabel(minutes)}` : `实际时长 ${durationLabel(clockInfo.minutes)}`}。</> : <>按{windowMode && !occupied ? '窗口开始' : '日程当天'}换算：芝加哥为{clockInfo.start.label}（{clockInfo.start.abbreviation} / UTC{clockInfo.start.offset}），北京快 {clockInfo.start.differenceHours} 小时。</>}</p>
          {windowMode && occupied ? <div className="planned-preview"><strong>已安排作答 · {durationLabel(minutes)}</strong><span>{dayLabel(occupied.start, true, BEIJING)} {rangeWithZone(occupied.start, occupied.end, BEIJING)}</span><span>{dayLabel(occupied.start, true, CHICAGO)} {rangeWithZone(occupied.start, occupied.end, CHICAGO)}</span></div> : null}
        </div> : null}
        {base && windowMode ? <div className="available-slots"><strong>{slots.length ? '可安排的连续时段' : '截止前没有足够的连续空闲时间'}</strong><span>两行是同一时段，第一行为{zoneLabel(editorZone)}。仅避开已确定的安排；其他未安排笔试还需分配时间。</span>{slots.slice(0, 3).map(slot => <button type="button" key={slot.start} onClick={() => selectPlanned(slot.start)}><span className="slot-times"><strong>{dayLabel(slot.start, false, editorZone)} {rangeWithZone(slot.start, slot.end, editorZone)}</strong><small>{dayLabel(slot.start, false, otherZone(editorZone))} {rangeWithZone(slot.start, slot.end, otherZone(editorZone))}</small></span><b>选此段开始</b></button>)}{slots.length > 3 ? <small>还有 {slots.length - 3} 段可用，也可自行填写计划时间。</small> : null}</div> : null}
        {overlaps.length ? <div className="editor-conflict"><CircleAlert size={18} /><div><strong>与 {overlaps.length} 条日程有时间重叠（{zoneLabel(editorZone)}）</strong>{overlaps.map(pair => { const other = pair.a.id === candidate?.id ? pair.b : pair.a; return <p key={other.id}>{eventLabel(other)} · {dayLabel(pair.start, false, editorZone)} {rangeWithZone(pair.start, pair.end, editorZone)}</p>; })}<span>你可以调整时间，也可以保留这条安排。</span></div></div> : null}
        <div className="form-row"><label htmlFor={`${prefix}-location`}>地点 / 面试方式<input id={`${prefix}-location`} placeholder="线上会议或线下地址" value={location} maxLength={1000} onChange={event => setLocation(event.target.value)} /></label><label htmlFor={`${prefix}-link`}>会议 / 笔试链接<div className="input-link"><input id={`${prefix}-link`} type="url" placeholder="https://" value={link} maxLength={1000} onChange={event => setLink(event.target.value)} />{event?.link ? <a href={event.link} target="_blank" rel="noreferrer" aria-label="打开日程链接"><ExternalLink size={16} /></a> : null}</div></label></div>
        <label htmlFor={`${prefix}-notes`}>备注<textarea id={`${prefix}-notes`} rows={3} placeholder="岗位、联系人、准备事项…" value={notes} maxLength={5000} onChange={event => setNotes(event.target.value)} /></label>
        <div className="color-options"><span className="form-label">时间条颜色</span><div>{COLORS.map(value => <button type="button" key={value} className={`color-swatch ${value} ${color === value ? 'selected' : ''}`} aria-label={COLOR_LABELS[value]} aria-pressed={color === value} onClick={() => setColor(value)} />)}</div></div>
      </fieldset>
      </div>
      {error && error !== durationError ? <div className="form-error" role="alert"><CircleAlert size={16} />{error}</div> : null}
      {deleting ? <div className="delete-confirm"><span>确定删除这条日程？</span><button type="button" className="text-button" disabled={saving} onClick={() => setDeleting(false)}>保留</button><button type="button" className="danger-button" disabled={saving} onClick={async () => { try { await onDelete(event!); } catch (cause) { setError((cause as Error).message); } }}>确认删除</button></div> : null}
      <div className="dialog-footer">{event && !demo ? <button type="button" className="delete-button" disabled={saving || deleting} onClick={() => setDeleting(true)}><Trash2 size={16} />删除日程</button> : <span className="form-footer-note"><CalendarDays size={15} />保存后自动检查冲突</span>}<div><button type="button" className="outline-button" disabled={saving} onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? '正在保存…' : demo && event ? '添加到我的日程' : '保存日程'}</button></div></div>
    </form>
  </Dialog>;
}
