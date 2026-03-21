import type { CurrenciesService } from "@bedrock/currencies";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";

import {
  ClientCreatedDataSchema,
  type IntegrationPayload,
} from "../contracts";

export interface ClientCreatedHandlerDeps {
  createCounterparty: PartiesModule["counterparties"]["commands"]["create"];
  listCounterparties: PartiesModule["counterparties"]["queries"]["list"];
  listCustomers: PartiesModule["customers"]["queries"]["list"];
  createRequisite: PartiesModule["requisites"]["commands"]["create"];
  listProviders: PartiesModule["requisites"]["queries"]["listProviders"];
  createProvider: PartiesModule["requisites"]["commands"]["createProvider"];
  findCurrencyByCode: CurrenciesService["findByCode"];
  logger: Logger;
}

function buildDescription(data: {
  inn?: string;
  kpp?: string;
  ogrn?: string;
  oktmo?: string;
  okpo?: string;
  directorName?: string;
  position?: string;
  directorBasis?: string;
  address?: string;
}): string | null {
  const lines: string[] = [];

  if (data.inn) lines.push(`ИНН: ${data.inn}`);
  if (data.kpp) lines.push(`КПП: ${data.kpp}`);
  if (data.ogrn) lines.push(`ОГРН: ${data.ogrn}`);
  if (data.oktmo) lines.push(`ОКТМО: ${data.oktmo}`);
  if (data.okpo) lines.push(`ОКПО: ${data.okpo}`);

  if (data.directorName) {
    const parts = [data.directorName];
    if (data.position) parts.push(data.position);
    if (data.directorBasis) parts.push(`(${data.directorBasis})`);
    lines.push(`Руководитель: ${parts.join(", ")}`);
  }

  if (data.address) lines.push(`Адрес: ${data.address}`);

  return lines.length > 0 ? lines.join("\n") : null;
}

function buildRequisiteLabel(bankName: string, account: string): string {
  const normalizedBankName = bankName.trim();
  const normalizedAccount = account.replace(/\s+/g, "").trim();
  const accountSuffix = normalizedAccount.slice(-4);

  return accountSuffix
    ? `${normalizedBankName} •${accountSuffix}`
    : normalizedBankName;
}

export function createClientCreatedHandler(deps: ClientCreatedHandlerDeps) {
  return async function handleClientCreated(
    event: IntegrationPayload,
  ): Promise<void> {
    const data = ClientCreatedDataSchema.parse(event.data);
    const externalId = String(event.entityId);

    // Dedup: check if counterparty with this externalId already exists
    const existing = await deps.listCounterparties({
      externalId,
    } as Parameters<typeof deps.listCounterparties>[0]);

    if (existing.data.length > 0) {
      deps.logger.info("Counterparty already exists, skipping creation", {
        externalId,
        existingCounterpartyId: existing.data[0]!.id,
      });
      return;
    }

    // Resolve customerId from metadata.userId
    let customerId: string | null = null;
    if (event.metadata.userId) {
      const customers = await deps.listCustomers({
        externalRef: String(event.metadata.userId),
      } as Parameters<typeof deps.listCustomers>[0]);

      if (customers.data.length > 0) {
        customerId = customers.data[0]!.id;
      } else {
        deps.logger.warn(
          "Customer not found for metadata.userId, creating counterparty without customerId",
          { userId: event.metadata.userId },
        );
      }
    }

    const fullName = data.orgType
      ? `${data.orgType} ${data.orgName}`
      : data.orgName;

    const description = buildDescription(data);

    const counterparty = await deps.createCounterparty({
      externalId,
      shortName: data.orgName,
      fullName,
      kind: "legal_entity",
      country: "RU",
      customerId,
      description,
    });

    deps.logger.info("Counterparty created from mpayments client event", {
      counterpartyId: counterparty.id,
      externalId,
      customerId,
    });

    // Create requisite only if bank details are present (bic is required for RU banks)
    if (data.bankName && data.account && data.bic && data.bankCountry) {
      await createRequisiteForCounterparty(deps, counterparty.id, {
        orgName: data.orgName,
        bankName: data.bankName,
        bankCountry: data.bankCountry,
        account: data.account,
        bic: data.bic,
        bankAddress: data.bankAddress,
        corrAccount: data.corrAccount,
        email: data.email,
        phone: data.phone,
      });
    }
  };

  async function createRequisiteForCounterparty(
    deps: ClientCreatedHandlerDeps,
    counterpartyId: string,
    data: {
      orgName: string;
      bankName: string;
      bankCountry: string;
      account: string;
      bic: string;
      bankAddress?: string;
      corrAccount?: string;
      email?: string;
      phone?: string;
    },
  ): Promise<void> {
    const currency = await deps.findCurrencyByCode("RUB");

    // Resolve or create provider
    const providers = await deps.listProviders({
      name: data.bankName,
    } as Parameters<typeof deps.listProviders>[0]);

    let providerId: string | undefined;
    for (const provider of providers.data) {
      if (provider.name.toLowerCase() === data.bankName.toLowerCase()) {
        providerId = provider.id;
        break;
      }
    }

    if (!providerId) {
      const provider = await deps.createProvider({
        kind: "bank",
        name: data.bankName,
        country: data.bankCountry,
        bic: data.bic,
      });
      providerId = provider.id;
    }

    const contact = [data.email, data.phone].filter(Boolean).join(", ");

    await deps.createRequisite({
      ownerType: "counterparty",
      ownerId: counterpartyId,
      providerId,
      currencyId: currency.id,
      kind: "bank",
      label: buildRequisiteLabel(data.bankName, data.account),
      description: null,
      beneficiaryName: data.orgName,
      institutionName: data.bankName,
      institutionCountry: data.bankCountry,
      bankAddress: data.bankAddress ?? null,
      accountNo: data.account,
      iban: null,
      bic: data.bic,
      swift: null,
      corrAccount: data.corrAccount ?? null,
      network: null,
      assetCode: null,
      address: null,
      memoTag: null,
      accountRef: null,
      subaccountRef: null,
      contact: contact || null,
      notes: null,
      isDefault: true,
    });

    deps.logger.info("Requisite created for counterparty", {
      counterpartyId,
      bankName: data.bankName,
    });
  }
}
