import { Entity, invariant } from "@bedrock/shared/core/domain";

import type {
  CreatePostingTemplateDefinition,
  PendingPostingTemplateDefinition,
} from "./pack-definition";

export type CompiledPostingTemplate =
  | (Omit<CreatePostingTemplateDefinition, "requiredRefs" | "pendingMode"> & {
      requiredRefs: string[];
      pendingMode: "allowed" | "required" | "forbidden";
    })
  | (Omit<PendingPostingTemplateDefinition, "requiredRefs"> & {
      requiredRefs: string[];
    });

export class CompiledPack extends Entity<string> {
  public readonly packKey: string;
  public readonly version: number;
  public readonly templates: readonly CompiledPostingTemplate[];
  public readonly checksum: string;
  public readonly templateLookup: Map<string, CompiledPostingTemplate>;

  constructor(input: {
    packKey: string;
    version: number;
    templates: CompiledPostingTemplate[];
    checksum: string;
  }) {
    invariant(
      input.packKey.trim().length > 0,
      "compiled_pack.pack_key_required",
      "Compiled pack requires packKey",
      { packKey: input.packKey },
    );
    invariant(
      Number.isInteger(input.version) && input.version > 0,
      "compiled_pack.version_invalid",
      "Compiled pack requires a positive integer version",
      { version: input.version },
    );
    invariant(
      input.checksum.trim().length > 0,
      "compiled_pack.checksum_required",
      "Compiled pack requires checksum",
      { checksum: input.checksum },
    );

    super(input.checksum);
    this.packKey = input.packKey.trim();
    this.version = input.version;
    this.templates = Object.freeze([...input.templates]);
    this.checksum = input.checksum.trim();
    this.templateLookup = new Map(
      this.templates.map((template) => [template.key, template]),
    );
  }

  toSerializable() {
    return {
      packKey: this.packKey,
      version: this.version,
      templates: [...this.templates],
    };
  }
}

export interface StoredCompiledPack {
  checksum: string;
  compiledJson: Record<string, unknown>;
}
