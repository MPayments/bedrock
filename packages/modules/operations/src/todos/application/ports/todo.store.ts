import type { Todo } from "../contracts/dto";
import type {
  CreateTodoInput,
  ToggleTodoInput,
  UpdateTodoInput,
} from "../contracts/commands";

export interface TodoStore {
  findById(id: number): Promise<Todo | null>;
  create(input: CreateTodoInput): Promise<Todo>;
  update(input: UpdateTodoInput): Promise<Todo | null>;
  toggle(input: ToggleTodoInput): Promise<Todo | null>;
  remove(id: number): Promise<boolean>;
}
