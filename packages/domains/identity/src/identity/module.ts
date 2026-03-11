import { defineModule, type DefinedModule } from "@bedrock/core";

import { profileModule } from "./profile/module";
import { usersModule } from "./users/module";

export const identityModule: DefinedModule = defineModule("identity", {
  imports: [usersModule, profileModule],
});
