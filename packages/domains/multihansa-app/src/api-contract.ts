import type { AppDescriptor } from "@bedrock/core";

import { createMultihansaApiModules } from "./modules";

function getMultihansaApiContract(): AppDescriptor {
  return multihansaApiContract;
}

export const multihansaApiContract = {
  modules: createMultihansaApiModules({
    getContract: getMultihansaApiContract,
  }),
} satisfies AppDescriptor;
