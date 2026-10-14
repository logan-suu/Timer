export type EventType = 'exam' | 'interview' | 'prep' | 'other';
export type EventColor = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'teal';
export type TimeZone = 'America/Chicago' | 'Asia/Shanghai';
export interface PlannerSettings { displayTimeZone: TimeZone; inputTimeZone: TimeZone; }
export interface ScheduleEvent {
  id: string;
  title: string;
  company: string;
  type: EventType;
  color: EventColor;
  start: string;
  end: string;
  location: string;
  link: string;
  notes: string;
  timeZone?: TimeZone;
  timing?: 'fixed' | 'window';
  durationMinutes?: number;
  plannedStart?: string;
}
export interface ScheduleDocument {
  version: 1;
  revision: number;
  events: ScheduleEvent[];
  demoDismissed: boolean;
  updatedAt: string | null;
  settings: PlannerSettings;
  recovered?: boolean;
  storage?: 'local' | 'cloud';
}
export interface ConflictPair {
  a: ScheduleEvent;
  b: ScheduleEvent;
  start: string;
  end: string;
  minutes: number;
}
export type Navigation = 'calendar' | 'conflicts' | 'all';
export const EVENT_TYPES: Record<EventType, { label: string; color: EventColor }> = {
  exam: { label: '笔试', color: 'purple' },
  interview: { label: '面试', color: 'blue' },
  prep: { label: '准备', color: 'green' },
  other: { label: '其他', color: 'orange' },
};
export const COLORS: EventColor[] = ['purple', 'blue', 'green', 'orange', 'pink', 'teal'];
export const COLOR_LABELS: Record<EventColor, string> = { purple: '紫色', blue: '蓝色', green: '绿色', orange: '橙色', pink: '粉色', teal: '青色' };
