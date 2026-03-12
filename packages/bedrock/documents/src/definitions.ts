import type { z } from "zod";

export interface DocumentProjectionDefinition {
  key: string;
  unique?: boolean;
}

export interface DocumentDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  schema: TSchema;
  links?: readonly string[];
  summary?: Record<string, unknown>;
  projections?: readonly DocumentProjectionDefinition[];
}

export interface DocumentPolicyDefinition {
  name: string;
  rules: Record<string, unknown>;
}

export function defineDocument<TSchema extends z.ZodTypeAny>(
  name: string,
  definition: Omit<DocumentDefinition<TSchema>, "name">,
): DocumentDefinition<TSchema> {
  return {
    name,
    ...definition,
  };
}

export function defineDocumentPolicy<T extends DocumentPolicyDefinition>(
  definition: T,
): T {
  return definition;
}

export function createDocumentsRuntime<TDefinitions extends readonly DocumentDefinition[]>(
  input: {
    documents: TDefinitions;
    workflows?: readonly unknown[];
    operations?: Record<string, unknown>;
    policy?: DocumentPolicyDefinition;
  },
) {
  const byName = new Map(input.documents.map((definition) => [definition.name, definition]));

  return {
    ...input,
    getDocumentDefinition(name: string) {
      const definition = byName.get(name);
      if (!definition) {
        throw new Error(`Unknown document definition: ${name}`);
      }
      return definition;
    },
  };
}
