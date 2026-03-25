import { ApplicationNotFoundError } from "../../../errors";
import type { ApplicationReads } from "../ports/application.reads";

export class FindApplicationByIdQuery {
  constructor(private readonly reads: ApplicationReads) {}

  async execute(id: number) {
    const application = await this.reads.findById(id);
    if (!application) {
      throw new ApplicationNotFoundError(id);
    }
    return application;
  }
}
