import type {
  BedrockComponentId,
  ComponentRuntimeService,
} from "@bedrock/platform/component-runtime";

function dedupeBookIds(bookIds: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const bookId of bookIds) {
    const normalized = bookId.trim();
    if (normalized.length === 0) {
      continue;
    }
    unique.add(normalized);
  }
  return [...unique];
}

export async function isComponentEnabledForBooks(input: {
  componentRuntime: ComponentRuntimeService;
  componentId: BedrockComponentId;
  bookIds?: readonly string[];
}): Promise<boolean> {
  const bookIds = dedupeBookIds(input.bookIds ?? []);

  if (bookIds.length === 0) {
    return input.componentRuntime.isComponentEnabled({
      componentId: input.componentId,
    });
  }

  for (const bookId of bookIds) {
    const enabled = await input.componentRuntime.isComponentEnabled({
      componentId: input.componentId,
      bookId,
    });
    if (!enabled) {
      return false;
    }
  }

  return true;
}
