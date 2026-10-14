import { validateEvents } from '../shared/domain.mjs';
import { validateSettings } from '../shared/timezones.mjs';

export class ScheduleError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const EMPTY = () => ({ version: 1, revision: 0, demoDismissed: false, events: [], settings: validateSettings(), updatedAt: null });
const expose = value => ({ ...value, storage: 'cloud' });
function validateDocument(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.revision) || value.revision < 0 || typeof value.demoDismissed !== 'boolean') throw new ScheduleError('日程格式不正确。');
  try {
    return { version: 1, revision: value.revision, demoDismissed: value.demoDismissed, events: validateEvents(value.events), settings: validateSettings(value.settings), updatedAt: value.updatedAt ?? null };
  } catch (error) { throw new ScheduleError(error.message); }
}
export class CloudScheduleStore {
  constructor(db) {
    if (!db) throw new ScheduleError('云端存储暂时不可用，请稍后重试。', 503);
    this.db = db;
  }
  async read() {
    const row = await this.db.prepare('SELECT revision, document, backup FROM planner_state WHERE id = ?').bind('main').first();
    if (!row) return expose(EMPTY());
    try {
      const document = validateDocument(JSON.parse(row.document));
      if (document.revision !== row.revision) throw new Error('Revision mismatch');
      return expose(document);
    } catch {
      try { return expose({ ...validateDocument(JSON.parse(row.backup)), revision: row.revision, recovered: true }); }
      catch { throw new ScheduleError('日程及备份无法读取，原数据已保留，请勿重新导入覆盖。', 500); }
    }
  }
  async write(input) {
    const current = await this.read();
    if (input.expectedRevision !== current.revision) throw new ScheduleError('日程已在其他设备或窗口更新。请重新读取后，再提交这次修改。', 409);
    if (typeof input.demoDismissed !== 'boolean') throw new ScheduleError('保存格式不正确。');
    const next = validateDocument({ version: 1, revision: current.revision + 1, demoDismissed: input.demoDismissed, events: input.events, settings: input.settings ?? current.settings, updatedAt: new Date().toISOString() });
    const body = JSON.stringify(next);
    // The compare-and-swap and previous-version backup are one atomic D1 statement.
    let result;
    if (current.revision === 0) {
      result = await this.db.prepare('INSERT INTO planner_state (id, revision, document, backup) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind('main', next.revision, body, JSON.stringify(validateDocument(current))).run();
    } else {
      result = await this.db.prepare('UPDATE planner_state SET revision = ?, document = ?, backup = ? WHERE id = ? AND revision = ?').bind(next.revision, body, JSON.stringify(validateDocument(current)), 'main', current.revision).run();
    }
    if (result.meta.changes !== 1) throw new ScheduleError('日程已在其他设备或窗口更新。请重新读取后，再提交这次修改。', 409);
    return expose(next);
  }
  async initialImport(input) {
    const document = validateDocument({ ...input, revision: Math.max(1, input.revision) });
    // This one-time endpoint is protected by the owner-private Sites boundary.
    // An existing row can never be replaced by migration or a retry.
    const result = await this.db.prepare('INSERT INTO planner_state (id, revision, document, backup) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind('main', document.revision, JSON.stringify(document), JSON.stringify(document)).run();
    return { imported: result.meta.changes === 1, document: await this.read() };
  }
}
export async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ScheduleError('需要使用 JSON 格式。', 415);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 8 * 1024 * 1024) throw new ScheduleError('文件过大，最大支持 8 MB。', 413);
  let value;
  try { value = JSON.parse(text); } catch { throw new ScheduleError('请求内容不是有效的 JSON。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ScheduleError('请求格式不正确。');
  return value;
}
export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if ((origin && new URL(origin).origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ScheduleError('仅允许从本工具页面访问。', 403);
}
export function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function failure(error) {
  return json({ error: error instanceof ScheduleError ? error.message : '云端暂时无法处理请求，请稍后重试。' }, error instanceof ScheduleError ? error.status : 500);
}
