import { defineModule, type DefinedModule } from "@bedrock/core";

import { usersController } from "./controller";
import { usersService } from "./service";

export const usersModule: DefinedModule = defineModule("users", {
  services: {
    users: usersService,
  },
  controllers: [usersController],
});
