import {
  ListApplicationsQuerySchema,
  type ListApplicationsQuery as ListApplicationsQueryInput,
} from "../contracts/queries";
import type { ApplicationReads } from "../ports/application.reads";

export class ListApplicationsQuery {
  constructor(private readonly reads: ApplicationReads) {}

  async execute(input?: ListApplicationsQueryInput) {
    const query = ListApplicationsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
