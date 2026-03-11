import { defineModule, type DefinedModule } from "@bedrock/core";

import { profileController } from "./controller";
import { profileService } from "./service";

export const profileModule: DefinedModule = defineModule("profile", {
  services: {
    profile: profileService,
  },
  controllers: [profileController],
});
