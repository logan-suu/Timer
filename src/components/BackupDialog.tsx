import { useRef, useState } from 'react';
import { Download, Upload, HardDrive, CircleAlert, Check, RefreshCw } from 'lucide-react';
import { Dialog } from './Dialog';
import type { PlannerSettings, ScheduleDocument, ScheduleEvent, TimeZone } from '../types';
import { dateKey, timeWithZone, zoneLabel } from '../lib/dates';
import { parseBackup } from '../lib/events';

export function BackupDialog({ document, saving, onImport, onClose, timeZone }: { timeZone: TimeZone; document: ScheduleDocument; saving: boolean; onImport: (events: ScheduleEvent[], settings?: PlannerSettings) => Promise<void>; onClose: () => void; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<ScheduleEvent[] | null>(null);
  const [importSettings, setImportSettings] = useState<PlannerSettings | undefined>();
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  function download() {
    const data = { version: 1, exportedAt: new Date().toISOString(), timezone: timeZone, settings: document.settings, events: document.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = `秋招日程备份-${dateKey(new Date(), timeZone)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setSuccess('备份已导出，请妥善保存下载的文件。');
  }
  async function selectFile(file?: File) {
    if (!file) return;
    setError(''); setSuccess(''); setImported(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('备份文件不能超过 8 MB。');
      const backup = parseBackup(await file.text()); setImported(backup.events); setImportSettings(backup.settings); setFilename(file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件读取失败。'); }
    finally { if (inputRef.current) inputRef.current.value = ''; }
  }
  async function apply() {
    if (!imported) return;
    setError('');
    try {
      const merged = new Map(document.events.map(event => [event.id, event]));
      // Keep existing records on duplicate IDs; merging must never silently overwrite edits.
      imported.forEach(event => { if (!merged.has(event.id)) merged.set(event.id, event); });
      const events = mode === 'replace' ? imported : [...merged.values()];
      if (events.length > 5000) throw new Error('合并后超过 5000 条，请选择替换导入或精简备份。');
      await onImport(events, mode === 'replace' ? importSettings : undefined); setImported(null); setSuccess(`已导入并保存，共 ${events.length} 条日程。`);
    } catch (cause) { setError((cause as Error).message); }
  }
  const cloud = document.storage === 'cloud';
  return <Dialog title="备份管理" subtitle={cloud ? '手机和电脑共用日程，也可以随时导出。' : '日程留在本机，也可以随时带走。'} onClose={onClose} busy={saving}>
    <div className="backup-content"><div className="storage-info"><HardDrive size={23} /><div><strong>{cloud ? '云端持久保存' : '本地文件保存'}</strong><p>{cloud ? '每次保存都会写入云端，并保留上一版备份。手机和电脑登录同一账号即可共用；关闭网页或电脑后，已保存的日程仍会保留。' : '每次保存都会写入 .data/schedule.json，并保留上一版备份。关闭或重启后，日程会自动恢复。'}</p><span>{document.updatedAt ? `最近保存：${dateKey(document.updatedAt, timeZone)} ${timeWithZone(document.updatedAt, timeZone)}` : '还没有个人日程'} · {document.events.length} 条日程</span></div></div>
      <div className="backup-actions"><button className="backup-action" onClick={download} disabled={saving}><Download size={21} /><div><strong>导出备份</strong><span>将个人日程保存为 JSON 文件</span></div></button><button className="backup-action" onClick={() => inputRef.current?.click()} disabled={saving}><Upload size={21} /><div><strong>导入备份</strong><span>从备份文件恢复或合并日程</span></div></button></div>
      <input ref={inputRef} type="file" accept=".json,application/json" className="visually-hidden" aria-label="选择备份文件" onChange={event => void selectFile(event.target.files?.[0])} />
      {imported ? <div className="import-preview"><strong>{filename}</strong><p>已检查：{imported.length} 条有效日程</p><div className="import-modes"><label><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />合并导入<span>保留现有日程，相同编号不覆盖</span></label><label><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />替换现有日程<span>用备份的 {imported.length} 条日程替换现有 {document.events.length} 条</span></label></div><button className="primary-button full" disabled={saving} onClick={() => void apply()}><RefreshCw size={15} />{saving ? '正在导入…' : mode === 'replace' ? '确认替换并导入' : '确认合并并导入'}</button></div> : null}
      {error ? <div className="form-error" role="alert"><CircleAlert size={16} />{error}</div> : null}{success ? <div className="backup-success" role="status"><Check size={16} />{success}</div> : null}
      <p className="timezone-note">日历当前显示{zoneLabel(timeZone)}。备份保留显示、对照时区设置和每条日程的录入时区；旧备份仍可导入，实际时间不会被重新解释。</p>
    </div><div className="dialog-footer"><span /><button className="outline-button" onClick={onClose} disabled={saving}>完成</button></div>
  </Dialog>;
}
