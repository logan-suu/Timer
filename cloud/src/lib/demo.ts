import type { EventColor, EventType, ScheduleEvent } from '../types';
import { addDays, atTime, startOfWeek, BEIJING, dateKey } from './dates';

export function createDemo(now: Date): ScheduleEvent[] {
  const monday = startOfWeek(dateKey(now, BEIJING));
  const definitions: [number, number, number, number, number, string, string, EventType, EventColor][] = [
    [0, 10, 0, 11, 30, '技术笔试', '字节跳动', 'exam', 'purple'],
    [0, 15, 0, 16, 0, '复盘与准备', '', 'prep', 'green'],
    [1, 9, 0, 10, 0, '一面', '腾讯', 'interview', 'blue'],
    [2, 10, 0, 12, 0, '在线笔试', '美团', 'exam', 'purple'],
    [3, 10, 0, 11, 0, '面试准备', '', 'prep', 'green'],
    [3, 14, 0, 15, 0, '一面', '小红书', 'interview', 'blue'],
    [4, 14, 0, 16, 0, '笔试', '阿里巴巴', 'exam', 'purple'],
    [4, 15, 0, 16, 30, '一面', '网易', 'interview', 'blue'],
    [4, 18, 0, 19, 0, '简历修改', '', 'prep', 'green'],
    [5, 10, 0, 11, 30, '校园宣讲会', '', 'other', 'orange'],
  ];
  return definitions.map(([day, sh, sm, eh, em, title, company, type, color], index) => ({
    id: `demo-${index}`, title, company, type, color, timeZone: BEIJING, start: atTime(addDays(monday, day), sh, sm, BEIJING).toISOString(),
    end: atTime(addDays(monday, day), eh, em, BEIJING).toISOString(), location: type === 'interview' ? '线上面试' : '',
    link: '', notes: '这是一条示例日程。保存后仅将这条日程添加到你的个人规划。',
  }));
}
