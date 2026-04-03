import { RequisiteNotFoundError } from "../errors";
import type { RequisiteReads } from "../ports/requisite.reads";

export class FindRequisiteByIdQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(id: string) {
    const requisite = await this.reads.findActiveById(id);

    if (!requisite) {
      throw new RequisiteNotFoundError(id);
    }

    return requisite;
  }
}
