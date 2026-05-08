import { createFileRoute } from "@tanstack/react-router"
import { db } from "@/db"
import { todos } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

export const Route = createFileRoute("/api/todos/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const body = await request.json()
        const result = await db.transaction(async (tx) => {
          await tx.update(todos).set(body).where(eq(todos.id, params.id))
          const [{ txid }] = await tx.execute<{ txid: string }>(
            sql`SELECT pg_current_xact_id()::xid::text AS txid`
          )
          return { txid: parseInt(txid) }
        })
        return Response.json(result)
      },

      DELETE: async ({ params }) => {
        const result = await db.transaction(async (tx) => {
          await tx.delete(todos).where(eq(todos.id, params.id))
          const [{ txid }] = await tx.execute<{ txid: string }>(
            sql`SELECT pg_current_xact_id()::xid::text AS txid`
          )
          return { txid: parseInt(txid) }
        })
        return Response.json(result)
      },
    },
  },
})
