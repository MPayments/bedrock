import { token } from "@bedrock/core";
import type { FeesService } from "@multihansa/treasury/fees";
import type { FxService } from "@multihansa/treasury/fx";
import type { PaymentsService } from "@multihansa/treasury/payments";

export const FeesDomainServiceToken = token<FeesService>(
  "multihansa.treasury.fees-domain-service",
);

export const FxDomainServiceToken = token<FxService>(
  "multihansa.treasury.fx-domain-service",
);

export const PaymentsDomainServiceToken = token<PaymentsService>(
  "multihansa.treasury.payments-domain-service",
);
