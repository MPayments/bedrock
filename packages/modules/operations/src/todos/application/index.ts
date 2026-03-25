import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateTodoCommand } from "./commands/create-todo";
import { DeleteTodoCommand } from "./commands/delete-todo";
import { ToggleTodoCommand } from "./commands/toggle-todo";
import { UpdateTodoCommand } from "./commands/update-todo";
import type { TodoReads } from "./ports/todo.reads";
import type { TodosCommandUnitOfWork } from "./ports/todos.uow";
import { FindTodoByIdQuery } from "./queries/find-todo-by-id";
import { ListTodosQuery } from "./queries/list-todos";

export interface TodosServiceDeps {
  runtime: ModuleRuntime;
  commandUow: TodosCommandUnitOfWork;
  reads: TodoReads;
}

export function createTodosService(deps: TodosServiceDeps) {
  const createTodo = new CreateTodoCommand(deps.runtime, deps.commandUow);
  const updateTodo = new UpdateTodoCommand(deps.runtime, deps.commandUow);
  const toggleTodo = new ToggleTodoCommand(deps.runtime, deps.commandUow);
  const deleteTodo = new DeleteTodoCommand(deps.runtime, deps.commandUow);
  const findById = new FindTodoByIdQuery(deps.reads);
  const listTodos = new ListTodosQuery(deps.reads);

  return {
    commands: {
      create: createTodo.execute.bind(createTodo),
      update: updateTodo.execute.bind(updateTodo),
      toggle: toggleTodo.execute.bind(toggleTodo),
      remove: deleteTodo.execute.bind(deleteTodo),
    },
    queries: {
      findById: findById.execute.bind(findById),
      list: listTodos.execute.bind(listTodos),
    },
  };
}

export type TodosService = ReturnType<typeof createTodosService>;
