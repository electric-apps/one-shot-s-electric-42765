# Plan: Real-Time Todo App with Electric SQL

## 1. App Description

A persistent todo app where each item has a text label and a done checkbox. Todos are stored in Postgres and synced across all open browser tabs in real time using Electric SQL — no page refresh needed.

## 2. User Flows

1. User opens the app and immediately sees the current todo list (synced from Postgres via Electric).
2. User types text in the input field and presses Enter or clicks "Add" to create a todo.
3. The new todo appears instantly (optimistic insert) and persists to Postgres; all other open tabs receive it.
4. User clicks the checkbox on a todo to toggle the done state — updates immediately in the UI and syncs to all tabs.
5. User clicks the delete button (×) on a todo to remove it — removed instantly and synced to all tabs.
6. Opening a second tab shows the same list; mutations made in either tab propagate to the other in real time.

## 3. Architecture Provisioning Commands

All required packages are already installed in `package.json`. No additional `pnpm add` is needed.

After implementing the schema (Phase 1), run migrations:

```bash
pnpm exec drizzle-kit generate
```

Then manually append `ALTER TABLE todos REPLICA IDENTITY FULL;` to the end of the generated migration SQL file (in `drizzle/` folder), then:

```bash
pnpm exec drizzle-kit migrate
```

## 4. Data Model

### `src/db/schema.ts`

Replace the placeholder export with:

```ts
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core"

export const todos = pgTable("todos", {
  id: uuid().primaryKey().defaultRandom(),
  text: text().notNull(),
  done: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
```

### `src/db/zod-schemas.ts`

Replace the placeholder export with:

```ts
import { createSelectSchema, createInsertSchema } from "drizzle-zod"
import { todos } from "./schema"

export const todoSelectSchema = createSelectSchema(todos)
export const todoInsertSchema = createInsertSchema(todos)

export type Todo = typeof todoSelectSchema._type
export type NewTodo = typeof todoInsertSchema._type
```

> CRITICAL: The generated migration must include `ALTER TABLE todos REPLICA IDENTITY FULL;`
> at the end. Without it, Electric cannot stream updates and deletes correctly.

## 5. API Routes and Collections

### `src/routes/api/todos.ts`

Handles both the Electric shape proxy (GET) and todo creation (POST).

```ts
import { createAPIFileRoute } from "@tanstack/start/api"
import { db } from "~/db"
import { todos } from "~/db/schema"
import { sql } from "drizzle-orm"
import { proxyElectricRequest } from "~/lib/electric-proxy"

export const Route = createAPIFileRoute("/api/todos")({
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
})
```

### `src/routes/api/todos.$id.ts`

Handles update (PATCH) and delete (DELETE) for a single todo.

```ts
import { createAPIFileRoute } from "@tanstack/start/api"
import { db } from "~/db"
import { todos } from "~/db/schema"
import { eq, sql } from "drizzle-orm"

export const Route = createAPIFileRoute("/api/todos/$id")({
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
})
```

### `src/db/collections/todos.ts`

Create this file (new directory `src/db/collections/`):

```ts
import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { snakeCamelMapper } from "@electric-sql/client"
import { absoluteApiUrl } from "~/lib/client-url"
import { todoSelectSchema } from "~/db/zod-schemas"

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
```

## 6. UI Structure

### `src/routes/index.tsx`

Replace the placeholder component entirely. Key requirements:
- Set `ssr: false` on route options (uses `useLiveQuery`)
- Import `useLiveQuery` from `@tanstack/react-db`
- Import `todoCollection` from `~/db/collections/todos`
- Import `eq` from `@tanstack/db` (for any `.where()` clauses)
- `const { data: todos = [] } = useLiveQuery(...)` — destructure `data`, never use the raw result as an array
- Order todos by `createdAt` ascending via `.orderBy()`

Layout:
- Centered card, max-width ~600px
- `<h1>` heading: "Todos"
- Row: text `<input>` + "Add" `<button>` to create a todo
- `<ul>` of todo items, each in a `<div>` (not `<button>`) containing:
  - `<input type="checkbox">` bound to `todo.done`, `onChange` calls `todoCollection.update`
  - `<span>` with todo text, `line-through` class when done
  - `<button>` for delete (×), calls `todoCollection.delete`, with `e.stopPropagation()`
- Tailwind classes for layout and styling; use Radix Themes or shadcn/ui primitives where appropriate

Mutation calls:
```ts
// Insert
await todoCollection.insert({
  id: crypto.randomUUID(),
  text: inputValue,
  done: false,
  createdAt: new Date(),
})

// Toggle done
await todoCollection.update({ id: todo.id, done: !todo.done })

// Delete
await todoCollection.delete({ id: todo.id })
```

Live query:
```ts
const { data: todos = [] } = useLiveQuery(
  todoCollection,
  (q) => q.from({ todo: todoCollection }).orderBy((r) => r.todo.createdAt)
)
```

## 7. Implementation Phases

### Phase 1: Schema & Migration
1. Implement `src/db/schema.ts` — define `todos` table with `id`, `text`, `done`, `createdAt`.
2. Implement `src/db/zod-schemas.ts` — `todoSelectSchema`, `todoInsertSchema`, `Todo` type.
3. Run `pnpm exec drizzle-kit generate` to produce the migration SQL file.
4. Open the generated migration file and append `ALTER TABLE todos REPLICA IDENTITY FULL;` at the end.
5. Run `pnpm exec drizzle-kit migrate` to apply the migration to Postgres.

### Phase 2: API Routes
6. Create `src/routes/api/todos.ts` — GET (shape proxy via `proxyElectricRequest`) + POST (create with txid).
7. Create `src/routes/api/todos.$id.ts` — PATCH (update with txid) + DELETE (delete with txid).

### Phase 3: Collection
8. Create directory `src/db/collections/` and file `todos.ts` with the Electric collection definition (onInsert, onUpdate, onDelete wired to API routes above).

### Phase 4: UI
9. Replace `src/routes/index.tsx`:
   - Export `Route` with `ssr: false`
   - Input + Add button for creating todos
   - `useLiveQuery` for the reactive list ordered by `createdAt`
   - Checkbox to toggle done (strikethrough text when done)
   - Delete button (×) per row with `e.stopPropagation()`

### Phase 5: Build & Verify
10. Run `pnpm typecheck` — fix any TypeScript errors before proceeding.
11. Run `pnpm build` — this runs preflight + typecheck automatically.
12. Start dev server with `pnpm dev` and verify:
    - Todos load from Postgres on page load
    - Adding a todo appears immediately and persists after reload
    - Toggling done updates the checkbox and text styling
    - Deleting a todo removes it
    - Opening two tabs and mutating in one tab updates the other in real time

### Phase 6: Tests
13. Add a Vitest test in `tests/todo-schema.test.ts` to validate the Zod schema:
    - Use `generateValidRow` from `tests/helpers/schema-test-utils.ts` to generate a valid todo
    - Verify `todoSelectSchema.safeParse(validRow).success === true`
    - Verify `todoInsertSchema.safeParse(rowWithoutCreatedAt).success === true`

### Phase 7: README
14. Update root `README.md` with:
    - Required env vars: `DATABASE_URL`, `ELECTRIC_URL` (or `ELECTRIC_SOURCE_ID` + `ELECTRIC_SECRET` for cloud)
    - Dev setup: `pnpm install`, `pnpm exec drizzle-kit migrate`, `pnpm dev`
