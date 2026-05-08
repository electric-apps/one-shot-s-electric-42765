import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { todoCollection } from "@/db/collections/todos"
import { useState } from "react"

export const Route = createFileRoute("/")({
  ssr: false,
  component: App,
})

function App() {
  const [inputValue, setInputValue] = useState("")

  const { data: todos = [] } = useLiveQuery(
    (q) => q.from({ todo: todoCollection }).orderBy((r) => r.todo.createdAt)
  )

  const handleAdd = async () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue("")
    await todoCollection.insert({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: new Date(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd()
  }

  return (
    <div className="flex min-h-svh items-start justify-center p-8">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold">Todos</h1>

        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() =>
                  todoCollection.update(todo.id, (draft) => {
                    draft.done = !todo.done
                  })
                }
                className="h-4 w-4 cursor-pointer accent-blue-600"
              />
              <span
                className={`flex-1 text-sm ${todo.done ? "text-gray-400 line-through" : "text-gray-800"}`}
              >
                {todo.text}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  todoCollection.delete(todo.id)
                }}
                className="text-gray-400 hover:text-red-500 focus:outline-none"
                aria-label="Delete todo"
              >
                ×
              </button>
            </div>
          ))}
        </ul>

        {todos.length === 0 && (
          <p className="text-center text-sm text-gray-400">No todos yet. Add one above!</p>
        )}
      </div>
    </div>
  )
}
