import {
  ListActivitiesQuerySchema,
  type ListActivitiesQuery as ListActivitiesQueryInput,
} from "../contracts/queries";
import type { ActivityLogReads } from "../ports/activity-log.reads";

export class ListActivitiesQuery {
  constructor(private readonly reads: ActivityLogReads) {}

  async execute(input?: ListActivitiesQueryInput) {
    const query = ListActivitiesQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
