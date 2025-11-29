import { relations, sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Users table - Store Telegram user information
export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  telegramId: text().notNull().unique(),
  firstName: text(),
  lastName: text(),
  phone: text(),
  languageCode: text(),
  isAdmin: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`).notNull()
});

// Circles table - Store circle configurations
export const circles = sqliteTable('circles', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  startDate: integer({ mode: 'timestamp' }),
  monthlyAmount: real().notNull(),
  isLocked: integer({ mode: 'boolean' }).notNull().default(false),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Circle months table - Store months for each circle
export const circleMonths = sqliteTable(
  'circle_months',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    circleId: integer()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    index: integer().notNull(),
    totalStocks: integer().notNull(),
    createdAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) =>
    [
      index('circle_months_circle_id_idx').on(table.circleId),
    ]
);

// Stocks table - Store user subscriptions to months
export const stocks = sqliteTable(
  'stocks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    circleId: integer()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    monthId: integer()
      .notNull()
      .references(() => circleMonths.id, { onDelete: 'cascade' }),
    stockCount: integer().notNull(),
    status: text({ enum: ['pending', 'confirmed'] })
      .notNull()
      .default('pending'),
    editable: integer({ mode: 'boolean' }).notNull().default(true),
    createdAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('stocks_user_id_idx').on(table.userId),
    index('stocks_circle_id_idx').on(table.circleId),
    index('stocks_month_id_idx').on(table.monthId),
  ]
);

// Payments table - Track payment status per user per month
export const payments = sqliteTable(
  'payments',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    circleId: integer()
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    monthId: integer()
      .notNull()
      .references(() => circleMonths.id, { onDelete: 'cascade' }),
    fileId: text().notNull(),
    status: text({ enum: ['paid', 'pending', 'rejected'] })
      .notNull()
      .default('paid'),
    paidAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('payments_user_id_idx').on(table.userId),
    index('payments_circle_id_idx').on(table.circleId),
    index('payments_month_id_idx').on(table.monthId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stocks: many(stocks),
  payments: many(payments),
}));

export const circlesRelations = relations(circles, ({ many }) => ({
  circleMonths: many(circleMonths),
  stocks: many(stocks),
  payments: many(payments),
}));

export const circleMonthsRelations = relations(circleMonths, ({ one, many }) => ({
  circle: one(circles, {
    fields: [circleMonths.circleId],
    references: [circles.id],
  }),
  stocks: many(stocks),
  payments: many(payments),
}));

export const stocksRelations = relations(stocks, ({ one }) => ({
  user: one(users, {
    fields: [stocks.userId],
    references: [users.id],
  }),
  circle: one(circles, {
    fields: [stocks.circleId],
    references: [circles.id],
  }),
  circleMonth: one(circleMonths, {
    fields: [stocks.monthId],
    references: [circleMonths.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  circle: one(circles, {
    fields: [payments.circleId],
    references: [circles.id],
  }),
  circleMonth: one(circleMonths, {
    fields: [payments.monthId],
    references: [circleMonths.id],
  }),
}));

