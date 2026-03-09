import type { z } from "zod";

export interface WorkflowTransitionDefinition {
  name: string;
  from: string[];
  to: string;
  effect?: string;
}

export interface WorkflowDefinition<TInput = unknown> {
  name: string;
  input: TInput;
  states: readonly string[];
  transitions: readonly WorkflowTransitionDefinition[];
}

export function defineWorkflow<TInput>(
  name: string,
  definition: Omit<WorkflowDefinition<TInput>, "name">,
): WorkflowDefinition<TInput> {
  return {
    name,
    ...definition,
  };
}

export function transition(name: string) {
  const state: WorkflowTransitionDefinition = {
    name,
    from: [],
    to: "",
  };

  return {
    from(...fromStates: string[]) {
      state.from = fromStates;
      return this;
    },
    to(toState: string) {
      state.to = toState;
      return this;
    },
    effect(effectName: string) {
      state.effect = effectName;
      return state;
    },
    done() {
      return state;
    },
  };
}

export type WorkflowSchema<TInput> = z.ZodType<TInput>;
