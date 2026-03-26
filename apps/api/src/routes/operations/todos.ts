import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

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

  return app
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
