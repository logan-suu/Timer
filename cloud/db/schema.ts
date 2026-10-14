import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const plannerState = sqliteTable('planner_state', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  document: text('document').notNull(),
  backup: text('backup'),
});
