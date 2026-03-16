import { Entity } from "@bedrock/shared/core/domain";

import {
  summarizeResolutions,
  type ReconciliationRunSummary,
} from "./exceptions";
import type { MatchResolution } from "./matching";

export interface ReconciliationRunDraft {
  source: string;
  rulesetChecksum: string;
  inputQuery: Record<string, unknown>;
  resultSummary: ReconciliationRunSummary;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  causationId: string | null;
}

export class ReconciliationRun extends Entity<string> {
  private constructor(
    id: string,
    private readonly draft: ReconciliationRunDraft,
  ) {
    super(id);
  }

  static plan(input: {
    source: string;
    rulesetChecksum: string;
    inputQuery: Record<string, unknown>;
    resolutions: MatchResolution[];
    requestContext?: {
      requestId?: string | null;
      correlationId?: string | null;
      traceId?: string | null;
      causationId?: string | null;
    };
  }): ReconciliationRun {
    return new ReconciliationRun("planned", {
      source: input.source,
      rulesetChecksum: input.rulesetChecksum,
      inputQuery: input.inputQuery,
      resultSummary: summarizeResolutions(input.resolutions),
      requestId: input.requestContext?.requestId ?? null,
      correlationId: input.requestContext?.correlationId ?? null,
      traceId: input.requestContext?.traceId ?? null,
      causationId: input.requestContext?.causationId ?? null,
    });
  }

  toDraft(): ReconciliationRunDraft {
    return { ...this.draft };
  }
}
