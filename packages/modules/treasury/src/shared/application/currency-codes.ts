import type { CurrenciesPort } from "./external-ports";

interface PairCurrencyRecord {
  fromCurrencyId: string;
  toCurrencyId: string;
}

function requireCurrencyCode(
  codeById: Map<string, string>,
  currencyId: string,
) {
  const code = codeById.get(currencyId);
  if (!code) {
    throw new Error(`Missing currency code for ${currencyId}`);
  }

  return code;
}

export async function listCurrencyCodesById(
  currencies: CurrenciesPort,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids)];
  const rows = await Promise.all(
    uniqueIds.map(
      async (id) => [id, (await currencies.findById(id)).code] as const,
    ),
  );

  return new Map(rows);
}

export async function listPairCurrencyCodesById<T extends PairCurrencyRecord>(
  currencies: CurrenciesPort,
  records: T[],
) {
  return listCurrencyCodesById(
    currencies,
    records.flatMap((record) => [record.fromCurrencyId, record.toCurrencyId]),
  );
}

export function withPairCurrencyCode<T extends PairCurrencyRecord>(
  record: T,
  codeById: Map<string, string>,
): T & { fromCurrency: string; toCurrency: string } {
  return {
    ...record,
    fromCurrency: requireCurrencyCode(codeById, record.fromCurrencyId),
    toCurrency: requireCurrencyCode(codeById, record.toCurrencyId),
  };
}

export function withPairCurrencyCodes<T extends PairCurrencyRecord>(
  records: T[],
  codeById: Map<string, string>,
): (T & { fromCurrency: string; toCurrency: string })[] {
  return records.map((record) => withPairCurrencyCode(record, codeById));
}

export async function enrichPairCurrencyRecord<T extends PairCurrencyRecord>(
  currencies: CurrenciesPort,
  record: T,
): Promise<T & { fromCurrency: string; toCurrency: string }> {
  const codeById = await listPairCurrencyCodesById(currencies, [record]);

  return withPairCurrencyCode(record, codeById);
}

export async function enrichPairCurrencyRecords<T extends PairCurrencyRecord>(
  currencies: CurrenciesPort,
  records: T[],
): Promise<(T & { fromCurrency: string; toCurrency: string })[]> {
  if (records.length === 0) {
    return [];
  }

  const codeById = await listPairCurrencyCodesById(currencies, records);

  return withPairCurrencyCodes(records, codeById);
}
