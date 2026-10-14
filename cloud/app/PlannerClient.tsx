'use client';
import { useEffect, useState, type ComponentType } from 'react';
export default function PlannerClient() {
  const [Planner, setPlanner] = useState<ComponentType | null>(null);
  useEffect(() => {
    let active = true;
    import('../src/App').then(module => { if (active) setPlanner(() => module.default); });
    return () => { active = false; };
  }, []);
  return Planner ? <Planner /> : <div className="view-empty"><h3>正在打开你的日程…</h3></div>;
}
