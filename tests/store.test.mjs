import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ScheduleStore } from '../server/store.mjs';

const event = { id: 'test', title: '技术一面', company: '测试公司', type: 'interview', color: 'blue', start: '2026-10-09T06:00:00Z', end: '2026-10-09T07:00:00Z', location: '线上', link: '', notes: '' };
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'career-planner-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, store: new ScheduleStore(dir) };
}
test('saved events survive a fresh store instance, including intentional empty schedules', async t => {
  const { dir, store } = await fixture(t);
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [event] });
  const reloaded = await new ScheduleStore(dir).read();
  assert.equal(reloaded.events[0].title, '技术一面');
  assert.equal(reloaded.revision, 1);
  await store.write({ expectedRevision: 1, demoDismissed: true, events: [] });
  const empty = await new ScheduleStore(dir).read();
  assert.equal(empty.events.length, 0);
  assert.equal(empty.demoDismissed, true);
  const backup = JSON.parse(await readFile(path.join(dir, 'schedule.backup.json'), 'utf8'));
  assert.equal(backup.events.length, 1);
});
test('two windows cannot overwrite each other with an outdated revision', async t => {
  const { store } = await fixture(t);
  const payload = { expectedRevision: 0, demoDismissed: true, events: [event] };
  const results = await Promise.allSettled([store.write(payload), store.write(payload)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal((await store.read()).revision, 1);
});
test('invalid import never replaces current data', async t => {
  const { dir, store } = await fixture(t);
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [event] });
  await assert.rejects(store.write({ expectedRevision: 1, demoDismissed: true, events: [{ ...event, title: '' }] }));
  assert.equal((await new ScheduleStore(dir).read()).events[0].title, event.title);
});
test('corrupted primary recovers previous version without copying corruption into backup', async t => {
  const { dir, store } = await fixture(t);
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [event] });
  await store.write({ expectedRevision: 1, demoDismissed: true, events: [{ ...event, title: '第二版' }] });
  await writeFile(path.join(dir, 'schedule.json'), '{broken');
  const recovered = new ScheduleStore(dir);
  assert.equal((await recovered.read()).recovered, true);
  assert.equal((await recovered.read()).events[0].title, event.title);
  await recovered.write({ expectedRevision: 1, demoDismissed: true, events: [{ ...event, title: '恢复后修改' }] });
  assert.equal((await new ScheduleStore(dir).read()).events[0].title, '恢复后修改');
  assert.equal(JSON.parse(await readFile(path.join(dir, 'schedule.backup.json'), 'utf8')).events[0].title, event.title);
});
test('unrecoverable files are preserved and never silently reset', async t => {
  const { dir } = await fixture(t);
  await writeFile(path.join(dir, 'schedule.json'), '{broken');
  const store = new ScheduleStore(dir);
  await assert.rejects(store.read(), /原文件已保留/);
  assert.equal(await readFile(path.join(dir, 'schedule.json'), 'utf8'), '{broken');
});

test('timezone settings and source timezone survive a fresh process/store', async t => {
  const { dir, store } = await fixture(t);
  const settings = { displayTimeZone: 'Asia/Shanghai', inputTimeZone: 'America/Chicago' };
  await store.write({ expectedRevision: 0, demoDismissed: true, events: [{ ...event, timeZone: 'Asia/Shanghai' }], settings });
  const restored = await new ScheduleStore(dir).read();
  assert.deepEqual(restored.settings, settings);
  assert.equal(restored.events[0].timeZone, 'Asia/Shanghai');
  assert.equal(restored.events[0].start, '2026-10-09T06:00:00.000Z');
});
test('legacy documents receive timezone defaults without reinterpreting old instants', async t => {
  const { dir } = await fixture(t);
  await writeFile(path.join(dir, 'schedule.json'), JSON.stringify({ version: 1, revision: 2, demoDismissed: true, events: [event], updatedAt: null }));
  const store = new ScheduleStore(dir);
  const restored = await store.read();
  assert.deepEqual(restored.settings, { displayTimeZone: 'America/Chicago', inputTimeZone: 'Asia/Shanghai' });
  assert.equal(restored.events[0].start, '2026-10-09T06:00:00.000Z');
  await store.write({ expectedRevision: 2, demoDismissed: true, events: restored.events });
  assert.equal((await new ScheduleStore(dir).read()).events[0].start, restored.events[0].start);
});
