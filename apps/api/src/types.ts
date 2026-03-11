import type { ApiContract } from "@bedrock/client";

import { multihansaApiContract } from "@multihansa/app";

export type AppType = ApiContract<typeof multihansaApiContract>;
