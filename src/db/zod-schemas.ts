import { createSelectSchema, createInsertSchema } from "drizzle-zod"
import { todos } from "./schema"

export const todoSelectSchema = createSelectSchema(todos)
export const todoInsertSchema = createInsertSchema(todos)

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
