import type { BedrockModuleId } from "@bedrock/app/module-runtime";
import type { ModuleRuntimeService } from "@bedrock/app/module-runtime";

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

export async function isModuleEnabledForBooks(input: {
  moduleRuntime: ModuleRuntimeService;
  moduleId: BedrockModuleId;
  bookIds?: readonly string[];
}): Promise<boolean> {
  const bookIds = dedupeBookIds(input.bookIds ?? []);

  if (bookIds.length === 0) {
    return input.moduleRuntime.isModuleEnabled({
      moduleId: input.moduleId,
    });
  }

  for (const bookId of bookIds) {
    const enabled = await input.moduleRuntime.isModuleEnabled({
      moduleId: input.moduleId,
      bookId,
    });
    if (!enabled) {
      return false;
    }
  }

  return true;
}
