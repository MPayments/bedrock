import {
  ListRequisiteOptionsQuerySchema,
  type ListRequisiteOptionsInput,
} from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class ListRequisiteOptionsQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(input?: ListRequisiteOptionsInput) {
    const query = ListRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await this.reads.listOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      currencyId: row.currencyId,
      providerId: row.providerId,
      kind: row.kind,
      label:
        row.currencyCode.trim().length > 0
          ? `${row.label} · ${row.currencyCode.trim().toUpperCase()}`
          : row.label,
    }));
  }
}
