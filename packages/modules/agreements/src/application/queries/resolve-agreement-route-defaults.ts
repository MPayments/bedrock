import { AgreementNotFoundError } from "../../errors";
import type {
  AgreementResolvedRouteDefaults,
} from "../contracts/dto";
import type { ResolveAgreementRouteDefaultsQuery } from "../contracts/queries";
import type { AgreementReads } from "../ports/agreement.reads";
import { resolveAgreementRouteDefaults } from "../shared/route-policy";

export class ResolveAgreementRouteDefaultsQueryHandler {
  constructor(private readonly reads: AgreementReads) {}

  async execute(input: {
    agreementId: string;
    dealType: ResolveAgreementRouteDefaultsQuery["dealType"];
    sourceCurrencyId: string | null;
    targetCurrencyId: string | null;
  }): Promise<AgreementResolvedRouteDefaults> {
    const agreement = await this.reads.findById(input.agreementId);

    if (!agreement) {
      throw new AgreementNotFoundError(input.agreementId);
    }

    return resolveAgreementRouteDefaults({
      agreement,
      dealType: input.dealType,
      sourceCurrencyId: input.sourceCurrencyId,
      targetCurrencyId: input.targetCurrencyId,
    });
  }
}
