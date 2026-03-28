import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CreateTodoInputSchema,
  ListTodosQuerySchema,
  PaginatedTodosSchema,
  ToggleTodoInputSchema,
  TodoSchema,
  UpdateTodoInputSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";

export function operationsTodosRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get", path: "/",
    tags: ["Operations - Todos"], summary: "List todos",
    request: { query: ListTodosQuerySchema },
    responses: { 200: { content: { "application/json": { schema: PaginatedTodosSchema } }, description: "OK" } },
  });
  const getRoute = createRoute({
    method: "get", path: "/{id}",
    tags: ["Operations - Todos"], summary: "Get todo",
    request: { params: OpsIdParamSchema },
    responses: {
      200: { content: { "application/json": { schema: TodoSchema } }, description: "OK" },
      404: { content: { "application/json": { schema: OpsErrorSchema } }, description: "Not found" },
    },
  });
  const createRoute_ = createRoute({
    method: "post", path: "/",
    tags: ["Operations - Todos"], summary: "Create todo",
    request: { body: { content: { "application/json": { schema: CreateTodoInputSchema } }, required: true } },
    responses: { 201: { content: { "application/json": { schema: TodoSchema } }, description: "Created" } },
  });
  const updateRoute = createRoute({
    method: "patch", path: "/{id}",
    tags: ["Operations - Todos"], summary: "Update todo",
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: UpdateTodoInputSchema } }, required: true } },
    responses: { 200: { content: { "application/json": { schema: TodoSchema } }, description: "Updated" } },
  });
  const toggleRoute = createRoute({
    method: "patch", path: "/{id}/toggle",
    tags: ["Operations - Todos"], summary: "Toggle todo completion",
    request: { params: OpsIdParamSchema, body: { content: { "application/json": { schema: ToggleTodoInputSchema } }, required: true } },
    responses: { 200: { content: { "application/json": { schema: TodoSchema } }, description: "Toggled" } },
  });
  const deleteRoute = createRoute({
    method: "delete", path: "/{id}",
    tags: ["Operations - Todos"], summary: "Delete todo",
    request: { params: OpsIdParamSchema },
    responses: { 200: { content: { "application/json": { schema: OpsDeletedSchema } }, description: "Deleted" } },
  });

  const reorderRoute = createRoute({
    method: "post",
    path: "/reorder",
    tags: ["Operations - Todos"],
    summary: "Reorder todos",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(z.object({ id: z.number().int(), order: z.number().int() })),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
        description: "Reordered",
      },
    },
  });

  const calendarRoute = createRoute({
    method: "get",
    path: "/calendar",
    tags: ["Operations - Todos"],
    summary: "Get todos for calendar month",
    request: {
      query: z.object({
        month: z.string().openapi({ description: "Month in YYYY-MM format" }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Calendar todos grouped by date",
      },
    },
  });

  return app
    .openapi(reorderRoute, async (c) => {
      const { items } = c.req.valid("json");
      await Promise.all(
        items.map((item) =>
          ctx.operationsModule.todos.commands.update({ id: item.id, order: item.order }),
        ),
      );
      return c.json({ success: true }, 200);
    })
    .openapi(calendarRoute, async (c) => {
      const { month } = c.req.valid("query");
      // Fetch all todos for the month using the list query
      const result = await ctx.operationsModule.todos.queries.list({
        offset: 0,
        limit: 200,
        sortBy: "order",
        sortOrder: "asc",
      });
      // Group by dueDate
      const grouped: Record<string, unknown[]> = { noDueDate: [] };
      const noDueDate = grouped.noDueDate!;
      const monthPrefix = month; // "YYYY-MM"
      for (const todo of result.data) {
        const dd = (todo as any).dueDate as string | null;
        if (dd && dd.startsWith(monthPrefix)) {
          if (!grouped[dd]) grouped[dd] = [];
          grouped[dd]!.push(todo);
        } else if (!dd) {
          noDueDate.push(todo);
        }
      }
      return c.json({
        month,
        todos: grouped,
        totalCount: result.data.length,
      }, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.operationsModule.todos.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const todo = await ctx.operationsModule.todos.queries.findById(id);
      if (!todo) return c.json({ error: "Todo not found" }, 404);
      return c.json(todo, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.todos.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.todos.commands.update({ ...input, id });
      return c.json(result, 200);
    })
    .openapi(toggleRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await ctx.operationsModule.todos.commands.toggle({ ...input, id });
      return c.json(result, 200);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.todos.commands.remove(id);
      return c.json({ deleted: true }, 200);
    });
}
