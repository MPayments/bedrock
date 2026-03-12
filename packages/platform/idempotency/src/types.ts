import type { IdempotencyService } from "./service";

export type IdempotencyPort = Pick<IdempotencyService, "withIdempotencyTx">;
