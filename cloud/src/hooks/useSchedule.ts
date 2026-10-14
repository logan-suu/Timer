import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlannerSettings, ScheduleDocument, ScheduleEvent } from '../types';

async function request(options?: RequestInit): Promise<ScheduleDocument> {
  const response = await fetch('/api/schedule', options);
  const data = await response.json() as ScheduleDocument & { error?: string };
  if (!response.ok) throw new Error(data.error || '无法连接本地服务，请确认工具正在运行。');
  return data;
}

export function useSchedule(pauseRefresh = false) {
  const [document, setDocument] = useState<ScheduleDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const paused = useRef(pauseRefresh);
  paused.current = pauseRefresh;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDocument(await request()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败，请重试。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (document?.storage !== 'cloud' || pauseRefresh) return;
    let cancelled = false;
    let refreshing = false;
    async function refresh() {
      if (cancelled || refreshing || paused.current || lock.current || window.document.visibilityState !== 'visible') return;
      refreshing = true;
      try {
        const next = await request();
        if (!cancelled && !paused.current && !lock.current) {
          setDocument(current => current && next.revision > current.revision ? next : current);
        }
      } catch { /* A failed background read leaves the last confirmed schedule available. */ }
      finally { refreshing = false; }
    }
    const timer = window.setInterval(() => void refresh(), 15000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.document.addEventListener('visibilitychange', onFocus);
    void refresh();
    return () => {
      cancelled = true; window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.document.removeEventListener('visibilitychange', onFocus);
    };
  }, [document?.storage, pauseRefresh]);
  useEffect(() => {
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);
  const save = async (events: ScheduleEvent[], demoDismissed = true, settings: PlannerSettings | undefined = document?.settings) => {
    if (!document || lock.current) throw new Error('正在保存，请稍后再试。');
    lock.current = true; setSaving(true); setError('');
    try {
      const next = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: document.revision, events, demoDismissed, settings }) });
      setDocument(next);
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存失败，请重试。';
      setError(message); throw new Error(message);
    } finally { lock.current = false; setSaving(false); }
  };
  return { document, loading, saving, error, load, save };
}
