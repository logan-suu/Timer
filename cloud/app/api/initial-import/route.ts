import { env } from 'cloudflare:workers';
import { CloudScheduleStore, checkOrigin, readJson, json, failure } from '../../../lib/schedule-store.mjs';
export const dynamic = 'force-dynamic';
// Service migration relies on the Site's owner-only platform access check.
// It is intentionally insert-only; it never overwrites saved or migrated data.
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return json(await new CloudScheduleStore(env.DB).initialImport(await readJson(request)));
  } catch (error) { return failure(error); }
}
