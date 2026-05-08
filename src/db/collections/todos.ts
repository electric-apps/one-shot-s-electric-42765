import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { snakeCamelMapper } from "@electric-sql/client"
import { absoluteApiUrl } from "@/lib/client-url"
import { todoSelectSchema } from "@/db/zod-schemas"

export const todoCollection = createCollection(
  electricCollectionOptions({
    id: "todos",
    schema: todoSelectSchema,
    getKey: (row) => row.id,
    shapeOptions: {
      url: absoluteApiUrl("/api/todos"),
      columnMapper: snakeCamelMapper(),
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
    },
    onInsert: async ({ transaction }) => {
      const newTodo = transaction.mutations[0].modified
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTodo.text }),
      })
      const { txid } = await res.json()
      return { txid }
    },
    onUpdate: async ({ transaction }) => {
      const updated = transaction.mutations[0].modified
      const res = await fetch(`/api/todos/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: updated.done, text: updated.text }),
      })
      const { txid } = await res.json()
      return { txid }
    },
    onDelete: async ({ transaction }) => {
      const deleted = transaction.mutations[0].original
      const res = await fetch(`/api/todos/${deleted.id}`, {
        method: "DELETE",
      })
      const { txid } = await res.json()
      return { txid }
    },
  })
)
