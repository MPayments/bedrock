import { defineModule } from "@bedrock/core";
import type { AppDescriptor } from "@bedrock/core";
import { DocumentsDomainServiceToken } from "@multihansa/documents";

import { createPlatformController } from "./controller";
import { createPlatformService } from "./service";


export function createPlatformModule(input: {
  getContract: () => AppDescriptor;
  openApiInfo: {
    title: string;
    version: string;
    description?: string;
  };
}) {
  const service = createPlatformService(input);
  const controller = createPlatformController({
    ...input,
    service,
  });

  return defineModule("platform", {
    services: {
      platform: service,
    },
    controllers: [controller],
    hooks: {
      onInit: async ({ get }) => {
        await get(DocumentsDomainServiceToken).validateAccountingSourceCoverage();
      },
    },
  });
}
