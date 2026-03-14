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

export interface CompiledPack {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
  checksum: string;
  templateLookup: Map<string, CompiledPostingTemplate>;
}

export interface StoredCompiledPack {
  checksum: string;
  compiledJson: Record<string, unknown>;
}
