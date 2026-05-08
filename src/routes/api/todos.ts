import { createFileRoute } from "@tanstack/react-router"
import { db } from "@/db"
import { todos } from "@/db/schema"
import { sql } from "drizzle-orm"
import { proxyElectricRequest } from "@/lib/electric-proxy"

export const Route = createFileRoute("/api/todos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return proxyElectricRequest(request, "todos")
      },

      POST: async ({ request }) => {
        const { text } = await request.json()
        const result = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(todos)
            .values({ id: crypto.randomUUID(), text, done: false })
            .returning()
          const [{ txid }] = await tx.execute<{ txid: string }>(
            sql`SELECT pg_current_xact_id()::xid::text AS txid`
          )
          return { id: row.id, txid: parseInt(txid) }
        })
        return Response.json(result)
      },
    },
  },
})
