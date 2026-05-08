import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core"

export const todos = pgTable("todos", {
  id: uuid().primaryKey().defaultRandom(),
  text: text().notNull(),
  done: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
