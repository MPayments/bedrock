import { canonicalJson } from "@bedrock/core/canon";
import { sha256Hex } from "@bedrock/platform-crypto";

import type {
  AccountingPackDefinition,
  CreatePostingTemplateDefinition,
  PendingPostingTemplateDefinition,
  RawPostingTemplateDefinition,
  ValueBinding,
} from "../../packs/schema";
import { AccountingPackCompilationError } from "../../errors";
import type {
  CompiledPack,
  CompiledPostingTemplate,
  PackValidationResult,
  StoredCompiledPack,
} from "./types";

interface CompiledPackSerializable {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
}

function isCreateTemplateDefinition(
  template: RawPostingTemplateDefinition,
): template is CreatePostingTemplateDefinition {
  return template.lineType === "create";
}

export function isCompiledCreateTemplate(
  template: CompiledPostingTemplate,
): template is Extract<CompiledPostingTemplate, { lineType: "create" }> {
  return template.lineType === "create";
}

function sortRecord<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  ) as Record<string, T>;
}

function normalizeTemplate(
  template: RawPostingTemplateDefinition,
): CompiledPostingTemplate {
  if (isCreateTemplateDefinition(template)) {
    return {
      ...template,
      pendingMode: template.pendingMode ?? "forbidden",
      requiredRefs: [...(template.requiredRefs ?? [])].sort(),
      requiredBookRefs: [...template.requiredBookRefs].sort(),
      requiredDimensions: [...template.requiredDimensions].sort(),
      allowSources: [...template.allowSources].sort(),
      debit: {
        accountNo: template.debit.accountNo,
        dimensions: sortRecord(template.debit.dimensions),
      },
      credit: {
        accountNo: template.credit.accountNo,
        dimensions: sortRecord(template.credit.dimensions),
      },
    };
  }

  return {
    ...template,
    requiredRefs: [...(template.requiredRefs ?? [])].sort(),
    requiredBookRefs: [...template.requiredBookRefs].sort(),
    requiredDimensions: [...template.requiredDimensions].sort(),
    allowSources: [...template.allowSources].sort(),
  };
}

function validateBindings(
  template: RawPostingTemplateDefinition,
  errors: string[],
) {
  if (!isCreateTemplateDefinition(template)) {
    return;
  }

  for (const [side, dimensions] of [
    ["debit", template.debit.dimensions],
    ["credit", template.credit.dimensions],
  ] as const) {
    for (const [dimensionKey, binding] of Object.entries(dimensions) as [
      string,
      ValueBinding,
    ][]) {
      if (binding.kind === "dimension") {
        if (!template.requiredDimensions.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared dimension "${binding.key}"`,
          );
        }
      }

      if (binding.kind === "ref") {
        if (!(template.requiredRefs ?? []).includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared ref "${binding.key}"`,
          );
        }
      }

      if (binding.kind === "bookRef") {
        if (!template.requiredBookRefs.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared bookRef "${binding.key}"`,
          );
        }
      }
    }
  }
}

export function validatePackDefinition(
  definition: AccountingPackDefinition,
): PackValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!definition.packKey.trim()) {
    errors.push("packKey must be non-empty");
  }

  if (!Number.isInteger(definition.version) || definition.version <= 0) {
    errors.push("version must be a positive integer");
  }

  for (const template of definition.templates) {
    if (seen.has(template.key)) {
      errors.push(`duplicate template key: ${template.key}`);
      continue;
    }
    seen.add(template.key);

    if (template.allowSources.length === 0) {
      errors.push(`${template.key}: allowSources must be non-empty`);
    }
    if (template.requiredBookRefs.length === 0) {
      errors.push(`${template.key}: requiredBookRefs must be non-empty`);
    }

    validateBindings(template, errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function compilePack(
  definition: AccountingPackDefinition,
): CompiledPack {
  const validation = validatePackDefinition(definition);
  if (!validation.ok) {
    throw new AccountingPackCompilationError(validation.errors);
  }

  const templates = [...definition.templates]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((template) => normalizeTemplate(template));

  const serializable: CompiledPackSerializable = {
    packKey: definition.packKey,
    version: definition.version,
    templates,
  };

  return {
    ...serializable,
    checksum: sha256Hex(canonicalJson(serializable)),
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}

export function serializeCompiledPack(pack: CompiledPack): StoredCompiledPack {
  return {
    checksum: pack.checksum,
    compiledJson: {
      packKey: pack.packKey,
      version: pack.version,
      checksum: pack.checksum,
      templates: pack.templates,
    },
  };
}

export function hydrateCompiledPack(
  compiledJson: Record<string, unknown>,
  checksumHint?: string,
): CompiledPack {
  const packKey = String(compiledJson.packKey);
  const version = Number(compiledJson.version);
  const templates = ((compiledJson.templates ?? []) as Record<string, unknown>[])
    .map((template) => {
      const allowSources =
        Array.isArray(template.allowSources) &&
        template.allowSources.every((item) => typeof item === "string")
          ? (template.allowSources as string[])
          : [];

      return {
        ...template,
        allowSources,
      } as CompiledPostingTemplate;
    })
    .sort((left, right) => left.key.localeCompare(right.key));
  const serializable: CompiledPackSerializable = {
    packKey,
    version,
    templates,
  };
  const checksum = sha256Hex(canonicalJson(serializable));

  if (checksumHint && checksum !== checksumHint) {
    throw new AccountingPackCompilationError([
      `Compiled pack checksum mismatch for ${packKey}@${version}`,
    ]);
  }

  return {
    ...serializable,
    checksum,
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}
