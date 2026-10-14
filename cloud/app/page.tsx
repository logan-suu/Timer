import { requireChatGPTUser } from './chatgpt-auth';
import PlannerClient from './PlannerClient';
export const dynamic = 'force-dynamic';
export default async function Home() {
  await requireChatGPTUser('/');
  return <PlannerClient />;
}
