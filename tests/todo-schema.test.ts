import { describe, it, expect } from "vitest"
import { todoSelectSchema, todoInsertSchema } from "@/db/zod-schemas"
import { generateValidRow, generateRowWithout } from "./helpers/schema-test-utils"

describe("todoSelectSchema", () => {
  it("accepts a valid todo row", () => {
    const row = generateValidRow(todoSelectSchema)
    const result = todoSelectSchema.safeParse(row)
    expect(result.success).toBe(true)
  })

  it("rejects a row missing required text field", () => {
    const row = generateRowWithout(todoSelectSchema, "text")
    const result = todoSelectSchema.safeParse(row)
    expect(result.success).toBe(false)
  })
})

describe("todoInsertSchema", () => {
  it("accepts a valid insert row without createdAt", () => {
    const row = generateRowWithout(todoInsertSchema, "createdAt")
    const result = todoInsertSchema.safeParse(row)
    expect(result.success).toBe(true)
  })
})
