import { token } from "@bedrock/core";
import type {
  DocumentRegistry,
} from "./types";
import type { DocumentsService } from "./runtime";

export const DocumentsDomainServiceToken = token<DocumentsService>(
  "multihansa.documents.domain-service",
);

export const DocumentRegistryToken = token<DocumentRegistry>(
  "multihansa.documents.registry",
);
