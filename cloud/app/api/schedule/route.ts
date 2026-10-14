import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { CloudScheduleStore, checkOrigin, readJson, json, failure } from '../../../lib/schedule-store.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await getChatGPTUser()) return json({ error: '登录已过期，请刷新页面重新登录。' }, 401);
  try { return json(await new CloudScheduleStore(env.DB).read()); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  if (!await getChatGPTUser()) return json({ error: '登录已过期，请刷新页面重新登录。' }, 401);
  try {
    checkOrigin(request);
    return json(await new CloudScheduleStore(env.DB).write(await readJson(request)));
  } catch (error) { return failure(error); }
}
