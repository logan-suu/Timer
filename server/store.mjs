import { mkdir, readFile, open, rename, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { validateEvents } from '../shared/domain.mjs';
import { validateSettings } from '../shared/timezones.mjs';

export class StoreError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export class ScheduleStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'schedule.json');
    this.backup = path.join(directory, 'schedule.backup.json');
    this.queue = Promise.resolve();
    this.snapshot = null;
    this.recovered = false;
  }
  validateDocument(value) {
    if (!value || value.version !== 1 || !Number.isInteger(value.revision) || value.revision < 0 || typeof value.demoDismissed !== 'boolean') throw new Error('数据文件格式不正确。');
    return { version: 1, revision: value.revision, demoDismissed: value.demoDismissed, events: validateEvents(value.events), settings: validateSettings(value.settings), updatedAt: value.updatedAt ?? null };
  }
  async read() {
    await this.queue;
    if (this.snapshot) return { ...this.snapshot, recovered: this.recovered };
    try { this.snapshot = this.validateDocument(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') {
        try { this.snapshot = this.validateDocument(JSON.parse(await readFile(this.backup, 'utf8'))); this.recovered = true; }
        catch (backupError) {
          if (backupError.code !== 'ENOENT') throw new StoreError('备份文件无法读取，请保留 .data 文件夹并手动检查。', 500);
          this.snapshot = { version: 1, revision: 0, demoDismissed: false, events: [], settings: validateSettings(), updatedAt: null };
        }
      } else {
        try { this.snapshot = this.validateDocument(JSON.parse(await readFile(this.backup, 'utf8'))); this.recovered = true; }
        catch { throw new StoreError('数据文件无法读取，且没有可用备份。原文件已保留，请勿删除 .data 文件夹。', 500); }
      }
    }
    return { ...this.snapshot, recovered: this.recovered };
  }
  async write(input) {
    // Finish initialization before entering the serialized write queue.
    await this.read();
    const operation = this.queue.then(async () => {
      if (input.expectedRevision !== this.snapshot.revision) throw new StoreError('日程已在其他窗口更新。请刷新页面，再提交这次修改。', 409);
      if (typeof input.demoDismissed !== 'boolean') throw new StoreError('保存格式不正确。');
      let events, settings;
      try { events = validateEvents(input.events); settings = validateSettings(input.settings ?? this.snapshot.settings); } catch (error) { throw new StoreError(error.message); }
      const next = { version: 1, revision: this.snapshot.revision + 1, demoDismissed: input.demoDismissed,
        events, settings, updatedAt: new Date().toISOString() };
      await mkdir(this.directory, { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      let handle;
      try {
        // The recovered snapshot is valid; never replace its backup with the corrupted primary file.
        if (!this.recovered) {
          try { await copyFile(this.file, this.backup); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        handle = await open(temporary, 'w', 0o600);
        await handle.writeFile(JSON.stringify(next, null, 2), 'utf8');
        await handle.sync();
        await handle.close(); handle = null;
        await rename(temporary, this.file);
        // Also sync the directory entry so an acknowledged save survives a process restart.
        const directory = await open(this.directory, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
      } catch (error) {
        if (handle) await handle.close().catch(() => {});
        await unlink(temporary).catch(() => {});
        throw new StoreError('保存失败，请检查磁盘空间或文件权限。此次修改尚未确认保存。', 500);
      }
      this.snapshot = next; this.recovered = false;
      return next;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
