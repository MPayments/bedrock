import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";
import { DomainError } from "@bedrock/shared/core/domain";

import {
  CompiledPack,
  type CompiledPostingTemplate,
  type StoredCompiledPack,
} from "./compiled-pack";
import type {
  AccountingPackDefinition,
  CreatePostingTemplateDefinition,
  RawPostingTemplateDefinition,
  ValueBinding,
} from "./pack-definition";
import type { PackValidationResult } from "./pack-validation";

interface CompiledPackSerializable {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
}

export interface PackReferenceValidationInput {
  knownAccountNos?: Iterable<string>;
  knownPostingCodes?: Iterable<string>;
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
  referenceData?: PackReferenceValidationInput,
): PackValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const knownAccountNos = referenceData?.knownAccountNos
    ? new Set(referenceData.knownAccountNos)
    : null;
  const knownPostingCodes = referenceData?.knownPostingCodes
    ? new Set(referenceData.knownPostingCodes)
    : null;

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

    if (isCreateTemplateDefinition(template)) {
      if (
        knownPostingCodes &&
        !knownPostingCodes.has(template.postingCode)
      ) {
        errors.push(
          `${template.key}: postingCode references unknown code "${template.postingCode}"`,
        );
      }

      if (knownAccountNos && !knownAccountNos.has(template.debit.accountNo)) {
        errors.push(
          `${template.key}: debit.accountNo references unknown account "${template.debit.accountNo}"`,
        );
      }

      if (
        knownAccountNos &&
        !knownAccountNos.has(template.credit.accountNo)
      ) {
        errors.push(
          `${template.key}: credit.accountNo references unknown account "${template.credit.accountNo}"`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function compilePack(
  definition: AccountingPackDefinition,
  referenceData?: PackReferenceValidationInput,
): CompiledPack {
  const validation = validatePackDefinition(definition, referenceData);
  if (!validation.ok) {
    throw new DomainError(
      "accounting_pack.compilation_failed",
      `Accounting pack compilation failed: ${validation.errors.join("; ")}`,
      {
        errors: validation.errors,
        packKey: definition.packKey,
        version: String(definition.version),
      },
    );
  }

  const templates = [...definition.templates]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((template) => normalizeTemplate(template));

  const serializable: CompiledPackSerializable = {
    packKey: definition.packKey,
    version: definition.version,
    templates,
  };

  return new CompiledPack({
    ...serializable,
    checksum: sha256Hex(canonicalJson(serializable)),
  });
}

export function serializeCompiledPack(pack: CompiledPack): StoredCompiledPack {
  return {
    checksum: pack.checksum,
    compiledJson: {
      ...pack.toSerializable(),
      checksum: pack.checksum,
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
    throw new DomainError(
      "accounting_pack.checksum_mismatch",
      `Compiled pack checksum mismatch for ${packKey}@${version}`,
      {
        packKey,
        version: String(version),
        checksumHint,
        checksum,
      },
    );
  }

  return new CompiledPack({
    ...serializable,
    checksum,
  });
}
