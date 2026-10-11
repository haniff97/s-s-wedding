import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rsvps = sqliteTable('rsvps', {
 id: text('id').primaryKey(), name: text('name').notNull(), attendance: text('attendance').notNull(), pax: integer('pax').notNull(), wish: text('wish').notNull(), visible: integer('visible').notNull().default(0), createdAt: integer('created_at').notNull(), rateKey: text('rate_key').notNull()
});
