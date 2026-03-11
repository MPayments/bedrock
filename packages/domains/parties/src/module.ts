import { defineModule, type DefinedModule } from "@bedrock/core";

import { counterpartiesModule } from "./counterparties/module";
import { counterpartyGroupsModule } from "./counterparty-groups/module";
import { customersModule } from "./customers/module";
import { organizationsModule } from "./organizations/module";
import { createPartiesBedrockProviders } from "./providers";
import { requisiteProvidersModule } from "./requisite-providers/module";
import { requisitesModule } from "./requisites/module";

export const partiesModule: DefinedModule = defineModule("parties", {
  providers: createPartiesBedrockProviders(),
  imports: [
    counterpartiesModule,
    counterpartyGroupsModule,
    customersModule,
    organizationsModule,
    requisiteProvidersModule,
    requisitesModule,
  ],
});
