import { eventStatus } from '../../shared/status.mjs';
import type { ScheduleEvent } from '../types';

export const STATUS_LABELS = { upcoming: '未开始', ongoing: '进行中', ended: '已结束', available: '待安排', expired: '已过期' };
const DESCRIPTIONS = {
  upcoming: '尚未到开始时间', ongoing: '当前处于已安排的时段内',
  ended: '已安排的时段已经结束', available: '笔试窗口已开放，尚未选择作答时间', expired: '尚未安排作答，笔试窗口已经截止',
};

export function EventStatus({ event, now }: { event: ScheduleEvent; now: number }) {
  const status = eventStatus(event, now);
  return <span className={`event-status status-${status}`} data-event-status={status} title={DESCRIPTIONS[status]}>{STATUS_LABELS[status]}</span>;
}
