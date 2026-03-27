import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toUnmatchedExternalRecordDto } from "../../../shared/application/mappers";
import {
  ListUnmatchedExternalRecordsInputSchema,
  type ListUnmatchedExternalRecordsInput,
} from "../../contracts";

export class ListUnmatchedExternalRecordsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListUnmatchedExternalRecordsInput = {}) {
    const validated = ListUnmatchedExternalRecordsInputSchema.parse(input);
    const rows = await this.context.reads.listUnmatchedExternalRecords(validated);
    return rows.map(toUnmatchedExternalRecordDto);
  }
}
