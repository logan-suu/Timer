import type { Metadata } from 'next';
import '../src/styles.css';
export const metadata: Metadata = {
  title: '秋招日程 · Career Planner',
  description: '安排笔试和面试，比较北京与芝加哥时间，手机和电脑共用日程。',
  icons: { icon: '/favicon.svg' },
  appleWebApp: { capable: true, title: '秋招日程', statusBarStyle: 'default' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
